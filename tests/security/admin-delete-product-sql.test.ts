// @vitest-environment node
//
// Régression : admin_delete_product() citait container_reservation_items en
// dur. Cette table n'existe pas dans le schéma distant, qui nomme la sienne
// reservation_items — la fonction échouait donc à chaque appel et le bouton
// « Supprimer » de l'espace admin ne faisait jamais rien.
//
// Le schéma monté ici est volontairement celui de la PRODUCTION
// (reservation_items), pas celui des migrations locales.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, it, expect } from 'vitest'

let db: PGlite

const BASE_SCHEMA = `
  create role anon;
  create role authenticated;
  grant usage on schema public to anon, authenticated;
  create function public.is_admin() returns boolean language sql as
    $$select coalesce(current_setting('test.admin', true), 'false') = 'true'$$;

  create table public.products (
    id text primary key,
    sku text not null,
    name text not null,
    main_image_url text,
    gallery_urls text[] default '{}',
    is_active boolean not null default true
  );
  create table public.product_variants (
    id text primary key,
    product_id text references public.products(id) on delete cascade,
    name text
  );
  create table public.product_partner_prices (
    id serial primary key,
    product_id text not null
  );
  create table public.reservation_items (
    id serial primary key,
    product_id text not null
  );
  create table public.showroom_locations (
    id serial primary key,
    product_skus text[] default '{}'
  );

  insert into public.products (id, sku, name, main_image_url, gallery_urls) values
    ('bis-044', 'BIS-044', 'Chaise', '/catalogue/bistro-seating-clean/BIS-044-01.webp',
      array['/catalogue/bistro-seating-clean/BIS-044-02.webp']),
    ('tes-015', 'TES-015', 'Assise', '/catalogue/teslin-series/TES-015-01.webp',
      array['/catalogue/teslin-series/TES-015-06.webp']),
    ('rop-001', 'ROP-001', 'Fauteuil', '/catalogue/rope-series/ROP-001-01.webp', '{}'),
    ('demo-1', 'DEM-001', 'Démo', 'https://images.unsplash.com/photo-1', '{}'),
    ('storage-1', 'STO-001', 'Studio', 'https://exemple.test/storage/a.webp', '{}');
  insert into public.product_variants (id, product_id, name) values ('v1', 'rop-001', 'Sable');
  insert into public.product_partner_prices (product_id) values ('rop-001'), ('tes-015');
  insert into public.showroom_locations (product_skus) values (array['ROP-001', 'TES-015']);
`

function migration(file: string): string {
  return readFileSync(`supabase/migrations/${file}`, 'utf8')
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(BASE_SCHEMA)
  await db.exec(migration('20260917120000_fix_admin_delete_product.sql'))
  await db.exec(migration('20260917130000_product_media_reviews.sql'))
}, 30000)

afterEach(async () => {
  await db?.close()
})

async function asAdmin(sql: string) {
  await db.exec(`set test.admin = 'true'`)
  return db.query<Record<string, unknown>>(sql)
}

it('supprime réellement un produit sur le schéma distant (reservation_items)', async () => {
  const result = await asAdmin(
    `select admin_delete_product('rop-001') as payload`,
  )
  expect(result.rows[0]?.payload).toMatchObject({ ok: true, deleted_id: 'rop-001' })

  const left = await db.query<{ n: number }>(
    `select count(*)::int as n from public.products where id = 'rop-001'`,
  )
  expect(left.rows[0]?.n).toBe(0)

  // Cascade et purges manuelles.
  for (const sql of [
    `select count(*)::int as n from public.product_variants where product_id = 'rop-001'`,
    `select count(*)::int as n from public.product_partner_prices where product_id = 'rop-001'`,
    `select count(*)::int as n from public.product_media_reviews where product_id = 'rop-001'`,
  ]) {
    expect((await db.query<{ n: number }>(sql)).rows[0]?.n).toBe(0)
  }

  const showroom = await db.query<{ skus: string[] }>(
    `select product_skus as skus from public.showroom_locations`,
  )
  expect(showroom.rows[0]?.skus).toEqual(['TES-015'])
})

it("refuse la suppression d'un produit présent dans une réservation", async () => {
  await db.exec(`insert into public.reservation_items (product_id) values ('rop-001')`)
  await expect(asAdmin(`select admin_delete_product('rop-001')`)).rejects.toThrow(
    /historique commercial/,
  )
  expect(
    (
      await db.query<{ n: number }>(
        `select count(*)::int as n from public.products where id = 'rop-001'`,
      )
    ).rows[0]?.n,
  ).toBe(1)
})

it('protège aussi le schéma local, où la table se nomme container_reservation_items', async () => {
  await db.exec(`
    drop table public.reservation_items;
    create table public.container_reservation_items (
      id serial primary key,
      product_id text not null
    );
    insert into public.container_reservation_items (product_id) values ('rop-001');
  `)
  await expect(asAdmin(`select admin_delete_product('rop-001')`)).rejects.toThrow(
    /historique commercial/,
  )
  await expect(
    asAdmin(`select admin_delete_product('tes-015') as payload`),
  ).resolves.toBeTruthy()
})

it('refuse un non-admin et un identifiant inconnu', async () => {
  await db.exec(`set test.admin = 'false'`)
  await expect(
    db.query(`select admin_delete_product('rop-001')`),
  ).rejects.toThrow(/admin only/)
  await expect(asAdmin(`select admin_delete_product('inconnu')`)).rejects.toThrow(
    /introuvable/,
  )
  await expect(asAdmin(`select admin_delete_product('  ')`)).rejects.toThrow(
    /product id requis/,
  )
})
