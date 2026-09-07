// Lot 0.5 Studio — garde anti-fuite des coûts fournisseur.
//
// Vérifie, sans base de données, que :
// 1. les migrations 37 (anon) et 38 (authenticated) accordent EXACTEMENT la
//    liste PUBLIC_PRODUCT_COLUMNS et jamais une colonne de coût ;
// 2. aucune définition de la vue products_public n'expose une colonne de
//    coût ;
// 3. product_pricing_inputs reste révoquée pour anon / public ;
// 4. le code admin ne fait plus `select('*')` sur products (un `*` échoue
//    dès que le rôle authenticated est restreint colonne par colonne) ;
// 5. le catalogue public lit la vue, pas la table.
// Le contrôle en conditions réelles (REST anon + compte de test non admin)
// est dans tests/integration/products-access.integration.test.ts et
// scripts/security/check-cost-exposure.mjs.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  INTERNAL_PRODUCT_COST_COLUMNS,
  PUBLIC_PRODUCT_COLUMNS,
} from '../../src/lib/catalogue/product-columns'

const ROOT = join(__dirname, '..', '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

const ANON_GRANT_MIGRATION = '20260907100000_products_anon_column_grants.sql'
const AUTHENTICATED_GRANT_MIGRATION =
  '20260907110000_products_authenticated_column_grants.sql'
const ANON_REVOKE_MIGRATION = '20260905110000_products_revoke_anon_cost_columns.sql'
const PRICING_INPUTS_MIGRATION = '20260706110000_admin_pricing_engine_parity.sql'

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8')
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

/** Colonnes d'un `grant select (…) on [table] public.products to <role>`. */
function grantedColumns(sql: string, role: string): ReadonlyArray<string> {
  const pattern = new RegExp(
    `grant\\s+select\\s*\\(([^)]*)\\)\\s*on\\s+(?:table\\s+)?public\\.products\\s+to\\s+${role}\\s*;`,
    'i',
  )
  const match = stripSqlComments(sql).match(pattern)
  const columns = match?.[1]
  if (!columns) return []
  return columns
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)
}

describe('products : grants colonne par colonne (anon et authenticated)', () => {
  const expected = [...PUBLIC_PRODUCT_COLUMNS].sort()

  it.each([
    ['anon', ANON_GRANT_MIGRATION],
    ['authenticated', AUTHENTICATED_GRANT_MIGRATION],
  ])('%s : la migration accorde exactement PUBLIC_PRODUCT_COLUMNS', (role, file) => {
    const granted = [...grantedColumns(readMigration(file), role)].sort()
    expect(granted).toEqual(expected)
    for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) {
      expect(granted).not.toContain(hidden)
    }
  })

  it('anon : le select table complet est révoqué (migration 31)', () => {
    const sql = stripSqlComments(readMigration(ANON_REVOKE_MIGRATION))
    expect(sql).toMatch(/revoke\s+select\s+on\s+table\s+public\.products\s+from\s+anon\s*;/i)
  })

  it('authenticated : le select table complet est révoqué (migration 38)', () => {
    const sql = stripSqlComments(readMigration(AUTHENTICATED_GRANT_MIGRATION))
    expect(sql).toMatch(
      /revoke\s+select\s+on\s+table\s+public\.products\s+from\s+authenticated\s*;/i,
    )
  })

  it('migration 38 : auto-vérification pour les deux rôles et les vues', () => {
    const sql = readMigration(AUTHENTICATED_GRANT_MIGRATION)
    expect(sql).toContain("array['anon', 'authenticated']")
    for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) {
      expect(sql).toContain(`'${hidden}'`)
    }
    expect(sql).toContain("has_table_privilege('anon', 'public.products_public', 'select')")
    expect(sql).toContain("has_table_privilege('authenticated', 'public.products', 'insert')")
  })

  it('migration 38 : aucune suppression, renommage ni modification de colonne', () => {
    const sql = stripSqlComments(readMigration(AUTHENTICATED_GRANT_MIGRATION))
    expect(sql).not.toMatch(/drop\s+column/i)
    expect(sql).not.toMatch(/rename\s+column/i)
    expect(sql).not.toMatch(/alter\s+column/i)
    expect(sql).not.toMatch(/drop\s+table/i)
  })
})

describe('products_public : aucune colonne de coût dans aucune définition', () => {
  const viewMigrations = readdirSync(MIGRATIONS_DIR).filter((file) =>
    /create\s+or\s+replace\s+view\s+public\.products_public/i.test(
      readMigration(file),
    ),
  )

  it('au moins une migration définit la vue', () => {
    expect(viewMigrations.length).toBeGreaterThan(0)
  })

  it.each(viewMigrations)('%s', (file) => {
    const sql = stripSqlComments(readMigration(file))
    const definitions = sql.split(/create\s+or\s+replace\s+view\s+public\.products_public/i)
    definitions.shift()
    expect(definitions.length).toBeGreaterThan(0)
    for (const definition of definitions) {
      const body = definition.split(';')[0]
      for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) {
        expect(body).not.toMatch(new RegExp(`\\b${hidden}\\b`))
      }
      for (const column of PUBLIC_PRODUCT_COLUMNS) {
        // Toute colonne publique connue de la dernière version doit être
        // présente dans la dernière définition ; les définitions plus
        // anciennes peuvent en avoir moins (colonnes ajoutées depuis).
        if (file === viewMigrations[viewMigrations.length - 1]) {
          expect(body).toMatch(new RegExp(`\\b${column}\\b`))
        }
      }
    }
  })
})

describe('product_pricing_inputs : jamais lisible par anon / public', () => {
  it('la migration révoque tout pour anon et public', () => {
    const sql = stripSqlComments(readMigration(PRICING_INPUTS_MIGRATION))
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.product_pricing_inputs\s+from\s+anon,\s*public,\s*authenticated\s*;/i,
    )
    // authenticated est re-accordé mais filtré par la RLS admin ; anon ne
    // reçoit aucun grant sur cette table.
    expect(sql).toMatch(/create policy "Admins full access product pricing inputs"/)
    expect(sql).not.toMatch(
      /grant[^;]*on\s+(?:table\s+)?public\.product_pricing_inputs[^;]*\banon\b/i,
    )
  })
})

describe('code applicatif : sélections explicites', () => {
  const repository = readFileSync(
    join(ROOT, 'src', 'lib', 'catalogue-admin', 'repository.ts'),
    'utf8',
  )
  const publicDb = readFileSync(
    join(ROOT, 'src', 'lib', 'catalogue', 'db.ts'),
    'utf8',
  )

  it("l'admin ne fait plus select('*') sur products", () => {
    // Normalise les sauts de ligne pour attraper `.from('products')\n.select('*')`.
    const flat = repository.replace(/\s+/g, ' ')
    expect(flat).not.toMatch(/\.from\('products'\)\s*\.select\('\*[^']*'\)/)
    expect(repository).toContain('PUBLIC_PRODUCT_SELECT')
  })

  it("le catalogue public lit products_public, jamais la table", () => {
    expect(publicDb).toContain(".from('products_public')")
    expect(publicDb).not.toContain(".from('products')")
  })

  it('toutes les colonnes de coût connues sont classées internes', () => {
    expect([...INTERNAL_PRODUCT_COST_COLUMNS].sort()).toEqual([
      'fob_usd',
      'is_loss_leader',
      'qty_per_container',
      'table_price_modifier_rate',
    ])
  })
})
