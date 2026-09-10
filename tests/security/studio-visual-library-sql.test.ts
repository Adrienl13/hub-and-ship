// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
import {
  VISUAL_LIBRARY_COLUMNS,
  VISUAL_ASSOCIATION_COLUMNS,
} from '../../src/lib/studio/visual-library'
const sql = readFileSync(
  'supabase/migrations/20260911110000_studio_visual_library.sql',
  'utf8',
)
const uid = '00000000-0000-0000-0000-000000000001'
let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;
 create table auth.users(id uuid primary key);insert into auth.users values ('${uid}');
 create function auth.uid() returns uuid language sql as $$select '${uid}'::uuid$$;
 create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
 create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
 create table products(id text primary key,category text,is_active boolean);insert into products values ('top','table_top',true),('base','table_base',true),('seat','chair',true);
 create table studio_product_profiles(product_id text primary key references products(id),studio_role text,model_family_id text);insert into studio_product_profiles values ('top','tabletop',null),('base','base',null),('seat','seat',null);
 grant usage on schema public,auth,extensions to anon,authenticated;
 grant select on products,studio_product_profiles to authenticated;
 create table studio_events(event_type text constraint studio_events_event_type_check check(event_type='studio_started'));
 `)

  await db.exec(
    'create table studio_model_families(id text primary key,status text);',
  )
  await db.exec(sql)
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('bibliothèque et sources privées uniquement admin ; aucune insertion anonyme', async () => {
  for (const table of [
    'studio_visual_library',
    'studio_visual_sources',
    'studio_visual_associations',
    'studio_visual_configurations',
  ]) {
    await db.exec('set role anon')
    await expect(db.query('select * from ' + table)).rejects.toMatchObject({
      code: '42501',
    })
    await db.exec('reset role;set role authenticated')
    expect((await db.query('select * from ' + table)).rows).toEqual([])
    await db.exec('reset role')
  }
  await db.exec('set role anon')
  await expect(
    db.exec(
      "insert into studio_visual_configurations(public_ref,snapshot) values ('PI-C-123456789012345678901234','{}')",
    ),
  ).rejects.toMatchObject({ code: '42501' })
  await db.exec('reset role')
})
it('sources et refs usine absentes des vues ; audit des associations et familles', async () => {
  await db.exec("set test.admin='true';set role authenticated")
  await db.exec(
    `insert into studio_visual_library(public_ref,family,label,thumbnail,image,active) values ('PI-TR-001','weave','Tressage 001','/studio/materials/pi-tr-001.webp','/studio/materials/pi-tr-001-detail.webp',true)`,
  )
  await db.exec(
    `insert into studio_visual_sources(public_ref,supplier,factory_ref,source_asset_uri,internal_notes) values ('PI-TR-001','PRIVATE_SUPPLIER','PRIVATE_FACTORY','private/source','PRIVATE_NOTE')`,
  )
  await expect(
    db.exec(
      `insert into studio_visual_associations(public_ref,product_id,status) values ('PI-TR-001','seat','verified')`,
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await db.exec(
    `insert into studio_visual_associations(public_ref,product_id,status,provenance) values ('PI-TR-001','seat','verified','Contrôle test')`,
  )
  expect(
    (await db.query('select verified_by from studio_visual_associations')).rows,
  ).toEqual([{ verified_by: uid }])
  await db.exec('reset role;set role anon')
  for (const [view, columns] of [
    ['studio_visual_library_public', VISUAL_LIBRARY_COLUMNS],
    ['studio_visual_associations_public', VISUAL_ASSOCIATION_COLUMNS],
  ] as const) {
    const result = await db.query('select * from ' + view)
    expect(result.fields.map((f) => f.name)).toEqual([...columns])
    expect(JSON.stringify(result.rows)).not.toMatch(
      /PRIVATE_|factory|supplier|provenance|verified_by|source_asset/,
    )
    expect(
      (
        await db.query(
          `select has_table_privilege('anon','${view}','DELETE') as allowed`,
        )
      ).rows,
    ).toEqual([{ allowed: false }])
    await expect(db.exec('delete from ' + view)).rejects.toThrow()
  }
  await db.exec("reset role;set test.admin='false'")
})
it('aucun seed de compatibilité ni modification des migrations précédentes', () => {
  expect(sql).not.toMatch(
    /insert into public|alter table public.studio_customization_capabilities|cost_price/i,
  )
})
it('un acheteur ne peut inscrire ni matière ni code privé ni association ni dossier', async () => {
  await db.exec("reset role;set test.admin='false';set role authenticated")
  for (const command of [
    "insert into studio_visual_library(public_ref,family,label,thumbnail,image) values ('PI-TR-002','weave','Test','/studio/materials/pi-tr-002.webp','/studio/materials/pi-tr-002-detail.webp')",
    "insert into studio_visual_sources(public_ref,supplier,source_asset_uri) values ('PI-TR-001','private','private')",
    "insert into studio_visual_associations(public_ref,product_id) values ('PI-TR-001','base')",
    "insert into studio_visual_configurations(public_ref,snapshot) values ('PI-C-000000000000000000000000','{}')",
  ])
    await expect(db.exec(command)).rejects.toMatchObject({ code: '42501' })
  await db.exec('reset role')
})
it('famille non vérifiée masquée et palette inconnue refusée', async () => {
  await db.exec(
    "insert into studio_model_families values ('family','candidate'); update studio_product_profiles set model_family_id='family' where product_id='base';set test.admin='true';set role authenticated",
  )
  await db.exec(
    "insert into studio_visual_associations(public_ref,model_family_id,status,provenance) values ('PI-TR-001','family','verified','Validation de test')",
  )
  await expect(
    db.exec(
      "update studio_visual_associations set palette_refs=ARRAY['PI-PA-001'] where model_family_id='family'",
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await db.exec('reset role;set role anon')
  expect(
    (
      await db.query(
        "select * from studio_visual_associations_public where product_id='base'",
      )
    ).rows,
  ).toHaveLength(0)
  await db.exec(
    "reset role;update studio_model_families set status='verified' where id='family';set role anon",
  )
  expect(
    (
      await db.query(
        "select * from studio_visual_associations_public where product_id='base'",
      )
    ).rows,
  ).toHaveLength(1)
  await db.exec(
    'reset role;update studio_visual_library set active=false;set role anon',
  )
  expect(
    (await db.query('select * from studio_visual_library_public')).rows,
  ).toHaveLength(0)
  expect(
    (await db.query('select * from studio_visual_associations_public')).rows,
  ).toHaveLength(0)
  await db.exec("reset role;set test.admin='false'")
})
