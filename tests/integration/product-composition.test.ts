// @vitest-environment node
//
// La composition décrit un ensemble pièce par pièce. Une composition à moitié
// saisie rendrait la fiche PLUS trompeuse qu'une absence de composition : la
// contrainte refuse donc tout ce qui n'est pas complet.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let db: PGlite

const SCHEMA = `
create table public.products (
  id text primary key,
  composition jsonb
);
insert into public.products (id) values ('p1');
`

// La migration fait trois choses : elle pose la contrainte, elle ouvre les
// vues et les grants, et elle patche `admin_save_product_full` en repartant de
// la définition qui tourne. Seule la première est rejouable hors production —
// les deux autres supposent les rôles Supabase et une fonction que PGlite n'a
// pas. On rejoue donc le préfixe, jusqu'à la ligne qui ouvre la partie accès ;
// l'ancre est vérifiée pour que ce test échoue franchement si la migration est
// réorganisée, plutôt que de valider une contrainte qu'il n'aurait pas posée.
const MIGRATION_FILE = readFileSync(
  'supabase/migrations/20260919090000_product_composition.sql',
  'utf8',
)
const ACCESS_MARKER = "-- La colonne ne sert à rien si elle n'est ni lisible ni écrivable."
const MIGRATION = MIGRATION_FILE.slice(0, MIGRATION_FILE.indexOf(ACCESS_MARKER))

const SALON = [
  { label: 'Canapé 3 places', qty: 1, l: 180, w: 80, h: 70 },
  { label: 'Fauteuil', qty: 2, l: 70, w: 70, h: 70 },
  { label: 'Table basse', qty: 1, l: 90, w: 50, h: 40 },
]

beforeAll(async () => {
  expect(MIGRATION_FILE).toContain(ACCESS_MARKER)
  expect(MIGRATION).toContain('products_composition_valid')
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(MIGRATION)
}, 30000)

afterAll(async () => {
  await db?.close()
})

async function valide(value: unknown): Promise<boolean> {
  const result = await db.query<{ ok: boolean }>(
    'select public.product_composition_is_valid($1::jsonb) as ok',
    [value === null ? null : JSON.stringify(value)],
  )
  return result.rows[0]!.ok
}

describe('composition d’un ensemble', () => {
  it('accepte un salon complet', async () => {
    expect(await valide(SALON)).toBe(true)
  })

  it('accepte NULL — un produit d’une seule pièce', async () => {
    expect(await valide(null)).toBe(true)
  })

  it('refuse une pièce sans cotes complètes', async () => {
    expect(await valide([{ label: 'Canapé', qty: 1, l: 180, w: 80 }])).toBe(false)
    expect(await valide([{ label: 'Canapé', qty: 1, l: 180, w: 0, h: 70 }])).toBe(
      false,
    )
  })

  it('refuse une pièce sans nom', async () => {
    expect(await valide([{ label: '  ', qty: 1, l: 180, w: 80, h: 70 }])).toBe(
      false,
    )
    expect(await valide([{ qty: 1, l: 180, w: 80, h: 70 }])).toBe(false)
  })

  it('refuse une quantité absurde', async () => {
    for (const qty of [0, -1, 51]) {
      expect(await valide([{ label: 'Fauteuil', qty, l: 70, w: 70, h: 70 }]), String(qty)).toBe(false)
    }
  })

  it('refuse une liste vide — c’est NULL qu’il faut écrire', async () => {
    expect(await valide([])).toBe(false)
  })

  it('refuse une cote hors de toute échelle de mobilier', async () => {
    expect(await valide([{ label: 'Canapé', qty: 1, l: 1800, w: 80, h: 70 }])).toBe(
      false,
    )
  })

  it('la contrainte de table refuse une composition incomplète', async () => {
    await expect(
      db.query('update public.products set composition = $1 where id = $2', [
        JSON.stringify([{ label: 'Canapé', qty: 1, l: 180 }]),
        'p1',
      ]),
    ).rejects.toThrow()

    await db.query('update public.products set composition = $1 where id = $2', [
      JSON.stringify(SALON),
      'p1',
    ])
    const row = await db.query<{ composition: unknown }>(
      'select composition from public.products where id = $1',
      ['p1'],
    )
    expect(row.rows[0]!.composition).toEqual(SALON)
  })
})
