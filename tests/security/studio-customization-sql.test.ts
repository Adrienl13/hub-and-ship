// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
import { CAPABILITY_PUBLIC_COLUMNS } from '../../src/lib/studio/customization-repository'
const sql = readFileSync(
  'supabase/migrations/20260911100000_studio_customization_capabilities.sql',
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
 create table studio_product_profiles(product_id text primary key references products(id),studio_role text);insert into studio_product_profiles values ('top','tabletop'),('base','base'),('seat','seat');
 grant usage on schema public,auth,extensions to anon,authenticated;
 grant select on products,studio_product_profiles to authenticated;
 create table studio_events(event_type text constraint studio_events_event_type_check check(event_type='studio_started'));
 `)

  await db.exec(sql)
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('aucun seed, surface vide et minimale', async () => {
  expect(sql).not.toMatch(/insert into|cost_price|purchase_price|service_role/i)
  await db.exec('set role anon')
  const result = await db.query(
    'select * from studio_customization_capabilities_public',
  )
  expect(result.rows).toEqual([])
  expect(result.fields.map((f) => f.name)).toEqual([
    ...CAPABILITY_PUBLIC_COLUMNS,
  ])
  await expect(
    db.query('select * from studio_customization_capabilities'),
  ).rejects.toMatchObject({ code: '42501' })
  await expect(
    db.exec(
      "insert into studio_customization_capabilities_public(scope,kind,status) values ('project','logo_request','verified')",
    ),
  ).rejects.toMatchObject({ code: '42501' })
  await db.exec('reset role;set role authenticated')
  expect(
    (await db.query('select * from studio_customization_capabilities')).rows,
  ).toEqual([])
  await expect(
    db.exec(
      "insert into studio_customization_capabilities(scope,kind) values ('project','logo_request')",
    ),
  ).rejects.toMatchObject({ code: '42501' })
  await db.exec('reset role')
})
it('audit serveur, contraintes et archivage sans fuite interne', async () => {
  await db.exec("set test.admin='true';set role authenticated")
  await db.exec(
    `insert into studio_customization_capabilities(product_id,scope,kind,status,values,provenance) values ('seat','seat','structure_color','verified','["Bleu"]','Fiche test')`,
  )
  expect(
    (
      await db.query(
        'select verified_by from studio_customization_capabilities',
      )
    ).rows,
  ).toEqual([{ verified_by: uid }])
  for (const payload of [
    "('seat','seat','rope_color','verified','[]','')",
    "('base','seat','rope_color','unknown','[]','')",
    "('seat','seat','base_color','unknown','[]','')",
    "('seat','seat','rope_color','unknown','{}','')",
    "('seat','seat','rope_color','unknown','[3]','')",
  ])
    await expect(
      db.exec(
        'insert into studio_customization_capabilities(product_id,scope,kind,status,values,provenance) values ' +
          payload,
      ),
    ).rejects.toMatchObject({ code: '23514' })
  await expect(
    db.exec(
      'update studio_customization_capabilities set min_quantity=90,max_quantity=10',
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await db.exec('reset role;set role anon')
  const result = await db.query(
    'select * from studio_customization_capabilities_public',
  )
  expect(result.rows).toHaveLength(1)
  expect(result.fields.map((f) => f.name)).toEqual([
    ...CAPABILITY_PUBLIC_COLUMNS,
  ])
  await db.exec(
    'reset role;set role authenticated;update studio_customization_capabilities set is_active=false;reset role;set role anon',
  )
  expect(
    (await db.query('select * from studio_customization_capabilities_public'))
      .rows,
  ).toEqual([])
  await db.exec("reset role;set test.admin='false'")
})
