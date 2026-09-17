// @vitest-environment node
//
// Migration 44 : file de relecture des photos produit. Le tri des visuels
// (chevalet d'usine, étiquette, fiche technique en chinois) revient au
// propriétaire du catalogue ; cette table ne fait qu'en garder la trace.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, it, expect } from 'vitest'

let db: PGlite

const BASE_SCHEMA = `
  create role anon;
  create role authenticated;
  grant usage on schema public to anon, authenticated;
  create function public.is_admin() returns boolean language sql as
    $$select true$$;

  create table public.products (
    id text primary key,
    sku text not null,
    name text not null,
    main_image_url text,
    gallery_urls text[] default '{}'
  );

  insert into public.products (id, sku, name, main_image_url, gallery_urls) values
    ('bis-044', 'BIS-044', 'Chaise', '/catalogue/bistro-seating-clean/BIS-044-01.webp',
      array['/catalogue/bistro-seating-clean/BIS-044-02.webp']),
    ('tes-015', 'TES-015', 'Assise', '/catalogue/teslin-series/TES-015-01.webp',
      array['/catalogue/teslin-series/TES-015-06.webp']),
    ('rop-001', 'ROP-001', 'Fauteuil', '/catalogue/rope-series/ROP-001-01.webp', '{}'),
    ('demo-1', 'DEM-001', 'Démo', 'https://images.unsplash.com/photo-1', '{}'),
    ('storage-1', 'STO-001', 'Studio', 'https://exemple.test/storage/a.webp', '{}');
`

function migration(file: string): string {
  return readFileSync(`supabase/migrations/${file}`, 'utf8')
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(BASE_SCHEMA)
  await db.exec(migration('20260917130000_product_media_reviews.sql'))
}, 30000)

afterEach(async () => {
  await db?.close()
})

it('amorce la relecture photo : lots fournisseur à relire, cas connus à corriger', async () => {
  const rows = await db.query<{ product_id: string; status: string; note: string }>(
    `select product_id, status, note from public.product_media_reviews order by product_id`,
  )
  const byId = new Map(rows.rows.map((r) => [r.product_id, r]))

  expect(byId.get('bis-044')?.status).toBe('fix')
  expect(byId.get('tes-015')?.status).toBe('fix')
  expect(byId.get('demo-1')?.status).toBe('fix')
  expect(byId.get('rop-001')?.status).toBe('pending')
  expect(byId.get('rop-001')?.note).toContain('rope-series')
  // Une fiche sans visuel de lot fournisseur n'entre pas dans la file.
  expect(byId.has('storage-1')).toBe(false)
})

it('ne réécrit pas une fiche déjà validée quand on rejoue la migration', async () => {
  await db.exec(
    `update public.product_media_reviews set status = 'ok', note = null where product_id = 'tes-015'`,
  )
  await db.exec(migration('20260917130000_product_media_reviews.sql'))
  const row = await db.query<{ status: string }>(
    `select status from public.product_media_reviews where product_id = 'tes-015'`,
  )
  expect(row.rows[0]?.status).toBe('ok')
})
