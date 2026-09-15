// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
let db: PGlite
const id = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const path = `${id}/20000000-0000-4000-8000-000000000001.jpg`
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema storage;
    create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to anon,authenticated;
    grant select on storage.objects to anon,authenticated;
    grant insert,update,delete on storage.objects to authenticated;
  `)
  await db.exec(
    readFileSync(
      'supabase/migrations/20260916100000_showroom_locations.sql',
      'utf8',
    ),
  )
  await db.exec(`insert into showroom_locations(id,name,address,city,postal_code,city_lat,city_lng,latitude,longitude,internal_note,photo_paths)
    values ('${id}','Nom privé','12 adresse privée','Lyon','69002',45.75,4.85,45.71234,4.81234,'Note confidentielle',array['${path}']);
    insert into storage.objects(bucket_id,name) values('showroom-photos','${path}');`)
}, 30000)
afterAll(async () => {
  await db?.close()
})
async function as(role: string, sql: string) {
  await db.exec(`reset role;set test.admin='false';set role ${role}`)
  try {
    return await db.query<Record<string, unknown>>(sql)
  } finally {
    await db.exec('reset role')
  }
}
async function publicRows() {
  const r = await as('anon', 'select list_public_showroom_locations() as data')
  return r.rows[0]?.data as Record<string, unknown>[]
}
it('no anonymous access to private records; normal accounts cannot read or write them', async () => {
  await expect(
    as('anon', 'select * from showroom_locations'),
  ).rejects.toMatchObject({ code: '42501' })
  expect(
    (await as('authenticated', 'select * from showroom_locations')).rows,
  ).toEqual([])
  expect(
    (
      await as(
        'authenticated',
        `update showroom_locations set name='forged' returning id`,
      )
    ).rows,
  ).toEqual([])
  expect(await publicRows()).toEqual([])
  expect((await as('anon', 'select * from storage.objects')).rows).toEqual([])
})
it('publication requires recorded agreement and public addresses require coordinates', async () => {
  await expect(
    db.exec(
      `update showroom_locations set visibility='on_request' where id='${id}'`,
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await expect(
    db.exec(
      `update showroom_locations set visibility='public',publication_agreed=true,consent_note='Accord test',latitude=null where id='${id}'`,
    ),
  ).rejects.toMatchObject({ code: '23514' })
})
it('on-request payload masks name, address and exact coordinates at the database boundary', async () => {
  await db.exec(
    `update showroom_locations set visibility='on_request',publication_agreed=true,consent_note='Accord test' where id='${id}'`,
  )
  const rows = await publicRows()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    name: 'Lieu équipé à Lyon',
    address: null,
    latitude: 45.75,
    longitude: 4.85,
    visibility: 'on_request',
  })
  const json = JSON.stringify(rows)
  for (const secret of [
    'Nom privé',
    '12 adresse privée',
    '45.71234',
    '4.81234',
    'internal_note',
    'consent_note',
    'Accord test',
  ])
    expect(json).not.toContain(secret)
  expect((await as('anon', 'select * from storage.objects')).rows).toHaveLength(
    1,
  )
})
it('public venue exposes only approved fields and retracting it removes public photo access', async () => {
  await db.exec(
    `update showroom_locations set visibility='public' where id='${id}'`,
  )
  expect((await publicRows())[0]).toMatchObject({
    name: 'Nom privé',
    address: '12 adresse privée',
    latitude: 45.71234,
  })
  await db.exec(
    `update showroom_locations set visibility='internal',publication_agreed=false where id='${id}'`,
  )
  expect(await publicRows()).toEqual([])
  expect((await as('anon', 'select * from storage.objects')).rows).toEqual([])
})
it('admin can edit; foreign photo paths and invalid coordinates are refused', async () => {
  await db.exec(
    `set test.admin='true';set role authenticated;update showroom_locations set description='Photos à venir' where id='${id}';reset role;set test.admin='false'`,
  )
  await expect(
    db.exec(
      `update showroom_locations set photo_paths=array['${other}/20000000-0000-4000-8000-000000000001.jpg'] where id='${id}'`,
    ),
  ).rejects.toMatchObject({ code: '23514' })
  await expect(
    db.exec(`update showroom_locations set latitude=95 where id='${id}'`),
  ).rejects.toMatchObject({ code: '23514' })
  await expect(
    as(
      'authenticated',
      `insert into storage.objects(bucket_id,name) values('showroom-photos','forged.jpg')`,
    ),
  ).rejects.toMatchObject({ code: '42501' })
})
