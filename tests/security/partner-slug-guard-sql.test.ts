// @vitest-environment node
//
// `/p/<n'importe quoi>` affichait une page co-brandée officielle au nom de
// n'importe quelle marque, et `/p/<slug arbitraire>?selection=<uuid>` servait
// la sélection publiée d'un VRAI partenaire sous ce nom arbitraire. Ces deux
// fonctions ferment les deux portes, et ne renvoient qu'un booléen : aucune
// donnée partenaire ne sort, donc aucune énumération possible.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'

let db: PGlite

const SCHEMA = `
  create role anon;
  create role authenticated;
  grant usage on schema public to anon, authenticated;

  create type public.partner_application_status as enum
    ('new','reviewing','qualified','approved','rejected','archived');
  create type public.partner_selection_status as enum
    ('draft','published','archived');

  create function public.normalize_partner_slug(value text)
  returns text language sql immutable set search_path to 'public','pg_temp' as $$
    select case
      when lower(trim(coalesce($1, ''))) ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
        then lower(trim($1))
      else null
    end;
  $$;

  create table public.partner_applications (
    id uuid primary key,
    partner_referral_slug text,
    status public.partner_application_status not null
  );
  create table public.partner_selections (
    id uuid primary key,
    partner_application_id uuid references public.partner_applications(id),
    status public.partner_selection_status not null
  );

  insert into public.partner_applications values
    ('10000000-0000-4000-8000-000000000001','mobilier-sud','approved'),
    ('10000000-0000-4000-8000-000000000002','archi-lyon','qualified'),
    ('10000000-0000-4000-8000-000000000003','en-cours','reviewing'),
    ('10000000-0000-4000-8000-000000000004','ecarte','rejected'),
    ('10000000-0000-4000-8000-000000000005',null,'approved');

  insert into public.partner_selections values
    ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','published'),
    ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','draft'),
    ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','published');
`

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(
    readFileSync(
      'supabase/migrations/20260918090000_partner_slug_guard.sql',
      'utf8',
    ),
  )
}, 30000)

afterAll(async () => {
  await db?.close()
})

async function slugActive(slug: string | null): Promise<boolean> {
  const result = await db.query<{ ok: boolean }>(
    'select public.partner_slug_is_active($1) as ok',
    [slug],
  )
  return result.rows[0]!.ok
}

async function selectionBelongs(
  selection: string,
  slug: string,
): Promise<boolean> {
  const result = await db.query<{ ok: boolean }>(
    'select public.published_selection_belongs_to_slug($1, $2) as ok',
    [selection, slug],
  )
  return result.rows[0]!.ok
}

it('ouvre la page aux seuls partenaires qualifiés ou approuvés', async () => {
  expect(await slugActive('mobilier-sud')).toBe(true)
  expect(await slugActive('archi-lyon')).toBe(true)
  // Candidature en cours d'examen ou écartée : pas de page co-brandée.
  expect(await slugActive('en-cours')).toBe(false)
  expect(await slugActive('ecarte')).toBe(false)
  // Le cas qui motive tout : une marque qui n'a jamais candidaté.
  expect(await slugActive('ikea')).toBe(false)
})

it('ignore la casse et refuse ce qui n’est pas un slug', async () => {
  expect(await slugActive('MOBILIER-SUD')).toBe(true)
  expect(await slugActive('  mobilier-sud  ')).toBe(true)
  for (const invalid of ['', '   ', '../etc', 'a b', '-tiret-devant', null]) {
    expect(await slugActive(invalid), String(invalid)).toBe(false)
  }
})

it('refuse de re-marquer la sélection publiée d’un autre partenaire', async () => {
  const selection = '20000000-0000-4000-8000-000000000001'
  expect(await selectionBelongs(selection, 'mobilier-sud')).toBe(true)
  // Le scénario de l'audit : le devis co-brandé d'un vrai partenaire,
  // ré-affiché sous un nom arbitraire.
  expect(await selectionBelongs(selection, 'ikea')).toBe(false)
  expect(await selectionBelongs(selection, 'archi-lyon')).toBe(false)
})

it('refuse une sélection non publiée ou inconnue', async () => {
  expect(
    await selectionBelongs(
      '20000000-0000-4000-8000-000000000002',
      'mobilier-sud',
    ),
  ).toBe(false)
  expect(
    await selectionBelongs(
      '99999999-0000-4000-8000-000000000000',
      'mobilier-sud',
    ),
  ).toBe(false)
})

it('ne laisse pas le rôle PUBLIC appeler ces fonctions', async () => {
  const result = await db.query<{ anon: boolean; pub: boolean }>(`
    select
      has_function_privilege('anon','public.partner_slug_is_active(text)','EXECUTE') as anon,
      has_function_privilege('public','public.partner_slug_is_active(text)','EXECUTE') as pub
  `)
  expect(result.rows[0]).toEqual({ anon: true, pub: false })
})
