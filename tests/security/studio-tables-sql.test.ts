// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
import { STUDIO_EVENT_TYPES } from '../../src/lib/studio/events'
import {
  TABLE_RULE_PUBLIC_COLUMNS,
  BASE_PROFILE_PUBLIC_COLUMNS,
} from '../../src/lib/studio/compatibility'
const sql = readFileSync(
  'supabase/migrations/20260909100000_studio_table_compatibility.sql',
  'utf8',
)
let db: PGlite
const uid = '00000000-0000-0000-0000-000000000001',
  type = '10000000-0000-0000-0000-000000000001'
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
  await db.exec(
    `set test.admin='true';set role authenticated;insert into studio_table_base_types(id,label) values ('${type}','Type testé');insert into studio_table_base_profiles(base_id,base_type_id,status,provenance) values ('base','${type}','verified','Fixture fabricant');insert into studio_tabletop_base_rules(base_id,tabletop_id,verdict,status,provenance) values ('base','top','allowed','verified','Fixture documentée');reset role;set test.admin='false'`,
  )
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('tables internes refusées à anon et RLS buyer, admin uniquement', async () => {
  const payloads = {
    studio_table_base_types: "(label) values ('Non autorisé')",
    studio_table_base_profiles: `(base_id,base_type_id) values ('base','${type}')`,
    studio_tabletop_base_rules:
      "(base_id,tabletop_id,verdict) values ('base','top','denied')",
  }
  for (const [table, payload] of Object.entries(payloads)) {
    await db.exec('set role anon')
    await expect(db.query(`select * from ${table}`)).rejects.toMatchObject({
      code: '42501',
    })
    await expect(
      db.exec(`insert into ${table} ${payload}`),
    ).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role;set role authenticated')
    expect((await db.query(`select * from ${table}`)).rows).toEqual([])
    await expect(
      db.exec(`insert into ${table} ${payload}`),
    ).rejects.toMatchObject({ code: '42501' })
    await db.exec("reset role;set test.admin='true';set role authenticated")
    expect(
      (await db.query(`select * from ${table}`)).rows.length,
    ).toBeGreaterThan(0)
    await db.exec("reset role;set test.admin='false'")
  }
})
it('projections minimales sans provenance, auteur ni coûts, non modifiables', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    for (const [view, columns] of [
      ['studio_tabletop_base_rules_public', TABLE_RULE_PUBLIC_COLUMNS],
      ['studio_table_base_profiles_public', BASE_PROFILE_PUBLIC_COLUMNS],
    ] as const) {
      const result = await db.query(`select * from ${view}`)
      expect(result.fields.map((f) => f.name)).toEqual([...columns])
      expect(result.rows).toHaveLength(1)
      await expect(db.exec(`delete from ${view}`)).rejects.toThrow()
    }
    await db.exec('reset role')
  }
})
it('audit serveur, contraintes, FK et retrait immédiat des règles archivées/inactives', async () => {
  await db.exec("set test.admin='true';set role authenticated")
  expect(
    (await db.query('select verified_by from studio_tabletop_base_rules')).rows,
  ).toEqual([{ verified_by: uid }])
  await expect(
    db.exec("update studio_tabletop_base_rules set provenance='' "),
  ).rejects.toMatchObject({ code: '23514' })
  await expect(
    db.exec(
      "insert into studio_tabletop_base_rules(base_id,tabletop_id,verdict) values ('seat','top','allowed')",
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await expect(
    db.exec(
      `insert into studio_tabletop_base_rules(base_type_id,shape,max_length_cm,max_width_cm,verdict) values ('${type}','round',70,90,'allowed')`,
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await expect(
    db.exec(
      "insert into studio_tabletop_base_rules(base_type_id,shape,max_length_cm,max_width_cm,verdict) values ('20000000-0000-0000-0000-000000000001','round',70,70,'allowed')",
    ),
  ).rejects.toMatchObject({ code: '23503' })
  await db.exec("begin;update studio_tabletop_base_rules set status='archived'")
  expect(
    (await db.query('select * from studio_tabletop_base_rules_public')).rows,
  ).toEqual([])
  expect(
    (await db.query('select verified_by from studio_tabletop_base_rules')).rows,
  ).toEqual([{ verified_by: null }])
  await db.exec('rollback;reset role;begin;update products set is_active=false')
  expect(
    (await db.query('select * from studio_tabletop_base_rules_public')).rows,
  ).toEqual([])
  expect(
    (await db.query('select * from studio_table_base_profiles_public')).rows,
  ).toEqual([])
  await db.exec("rollback;reset role;set test.admin='false'")
})
it('contrat complet des événements en parité DB/code', async () => {
  for (const event of STUDIO_EVENT_TYPES)
    await db.query('insert into studio_events(event_type) values ($1)', [event])
  await expect(
    db.query("insert into studio_events values ('unknown')"),
  ).rejects.toMatchObject({ code: '23514' })
})
it('migration additive non appliquée, sans seed commercial', () => {
  expect(sql).toContain('NON APPLIQUÉE EN PRODUCTION')
  expect(sql).not.toMatch(
    /insert into public\.studio_table|service_role|cost_price|purchase_price/i,
  )
})
