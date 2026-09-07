// Parité entre le script REST `security:studio` (JavaScript, listes
// dupliquées) et les constantes TypeScript du repository Studio : une colonne
// publique ou interne ajoutée d'un côté doit l'être de l'autre.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PUBLIC_PRODUCT_COLUMNS } from '../../src/lib/catalogue/product-columns'
import { DATA_QUALITY_FIELDS, DATA_QUALITY_SOURCES, DATA_QUALITY_STATUSES } from '../../src/lib/studio/types'
import {
  FULFILLMENT_OPTION_COLUMNS,
  MODEL_FAMILY_PUBLIC_COLUMNS,
  STUDIO_INTERNAL_COLUMNS,
  STUDIO_PROFILE_COLUMNS,
} from '../../src/lib/studio/repository'

const script = readFileSync(
  join(process.cwd(), 'scripts', 'security', 'check-studio-access.mjs'),
  'utf8',
)

function list(name: string): string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = script.match(new RegExp(`const ${escaped}${name.endsWith('(') ? '' : ' = '}\\[([^\\]]*)\\]`))
  expect(match, name).not.toBeNull()
  return [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
}

function surfaceColumns(view: string): string[] {
  const start = script.indexOf(`view: '${view}'`)
  expect(start, view).toBeGreaterThanOrEqual(0)
  const segment = script.slice(start, script.indexOf('}', start))
  return [...segment.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '').filter((v) => v !== view)
}

describe('security:studio — parité avec le code', () => {
  it('colonnes internes identiques', () => {
    expect(list('STUDIO_INTERNAL_COLUMNS')).toEqual([...STUDIO_INTERNAL_COLUMNS])
  })

  it('colonnes publiques de products et du profil identiques', () => {
    expect(list('PRODUCT_COLUMNS')).toEqual([...PUBLIC_PRODUCT_COLUMNS])
    expect(list('PROFILE_COLUMNS')).toEqual([...STUDIO_PROFILE_COLUMNS])
  })

  it('surfaces publiques identiques', () => {
    expect(surfaceColumns('studio_fulfillment_options_public')).toEqual([...FULFILLMENT_OPTION_COLUMNS])
    expect(surfaceColumns('studio_model_families_public')).toEqual([...MODEL_FAMILY_PUBLIC_COLUMNS])
  })

  it('tente explicitement de lire chaque colonne interne sur les tables et les vues', () => {
    expect(script).toMatch(/for \(const table of INTERNAL_TABLES\)/)
    expect(script).toMatch(/for \(const column of STUDIO_INTERNAL_COLUMNS\)/)
    expect(script).toMatch(/for \(const column of \[\.\.\.STUDIO_INTERNAL_COLUMNS, \.\.\.INTERNAL_COST_COLUMNS\]\)/)
    expect(script).toContain("DATA_QUALITY_PUBLIC_KEYS = new Set(['status', 'source', 'updatedAt'])")
    expect(list('DATA_QUALITY_FIELDS = new Set(')).toEqual([...DATA_QUALITY_FIELDS])
    expect(list('DATA_QUALITY_STATUSES = new Set(')).toEqual([...DATA_QUALITY_STATUSES])
    expect(list('DATA_QUALITY_SOURCES = new Set(')).toEqual([...DATA_QUALITY_SOURCES])
    expect(script).toContain("['standard_production', 'grouped_production'].includes(row.mode)")
    expect(script).toContain('familles publiques : status verified seulement')
    expect(script).toContain('options publiques : uniquement des produits visibles')
    expect(script).not.toMatch(/method:\s*'(POST|PATCH|PUT|DELETE)'.*rest\//)
  })
})
