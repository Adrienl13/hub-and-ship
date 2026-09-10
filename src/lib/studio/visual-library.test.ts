// @vitest-environment node
import { readFileSync } from 'node:fs'
import { it, expect } from 'vitest'
import { libraryItemSchema, visualAssociationStatus } from './visual-library'
import {
  evaluateCustomization,
  lineTargets,
  EMPTY_CAPABILITIES,
} from './customization'
import {
  configurationSnapshot,
  configurationReference,
} from './visual-configuration'
import { item } from './fixtures.test-helpers'
it('151 références publiques uniques, sans rattachements ni codes source', () => {
  const data = JSON.parse(
    readFileSync('public/studio/materials/library.json', 'utf8'),
  )
  expect(data).toHaveLength(151)
  expect(
    new Set(data.map((r: { public_ref: string }) => r.public_ref)).size,
  ).toBe(151)
  for (const row of data) {
    expect(libraryItemSchema.safeParse(row).success).toBe(true)
    expect(row.color_customization).toBe('unknown')
    expect(row.color_zones).toBeNull()
  }
  expect(JSON.stringify(data)).not.toMatch(
    /factory|supplier|provenance|S-PE|TS-0|0L6|PL-30|FM50|source-/i,
  )
  expect(
    libraryItemSchema.safeParse({ ...data[0], factory_ref: 'private' }).success,
  ).toBe(false)
})
it('aucune association implicite ; conflits conservateurs', () => {
  expect(visualAssociationStatus('p', 'PI-TR-001', [])).toBe('unknown')
  const row = {
    product_id: 'p',
    public_ref: 'PI-TR-001',
    status: 'verified' as const,
    palette_refs: [],
  }
  expect(visualAssociationStatus('p', 'PI-TR-001', [row])).toBe('verified')
  expect(visualAssociationStatus('other', 'PI-TR-001', [row])).toBe('unknown')
  expect(visualAssociationStatus('p', 'PI-TR-001', [row, row])).toBe('unknown')
})
it('motif et couleurs distincts, sans certification par la planche', () => {
  const target = lineTargets('test', 60, { seat: 'p' })[1]!
  const choice = {
    kind: 'weave_pattern' as const,
    value: 'PI-TR-001',
    note: '',
    requested: true,
    visual: { public_ref: 'PI-TR-001', weave_colors: ['Bleu', 'Ivoire'] },
  }
  const result = evaluateCustomization(
    [target],
    { [target.key]: [choice] },
    EMPTY_CAPABILITIES,
  )
  expect(result.state).toBe('feasibility_review')
  expect(result.canSend).toBe(true)
  expect(result.selections[0]?.status).toBe('unknown')
})
it('référence de configuration stable, complète et sensible aux choix', async () => {
  const i = item('p', 60)
  const a = configurationSnapshot([i], [], {})
  expect(await configurationReference(a)).toMatch(/^PI-C-[0-9A-F]{24}$/)
  expect(await configurationReference(a)).toBe(
    await configurationReference({ ...a, items: [{ ...i }] }),
  )
  expect(await configurationReference(a)).not.toBe(
    await configurationReference(
      configurationSnapshot([item('p', 61)], [], {}),
    ),
  )
})
it('une capability produit ne certifie pas un motif ni une palette sans preuve exacte', () => {
  const target = lineTargets('test', 60, { seat: 'p' })[1]!
  const capability = {
    id: 'c',
    product_id: 'p',
    scope: 'seat' as const,
    kind: 'weave_pattern' as const,
    status: 'verified' as const,
    values: ['PI-TR-001'],
    allows_free_text: false,
    requires_review: false,
    min_quantity: null,
    max_quantity: null,
  }
  const choice = {
    kind: 'weave_pattern' as const,
    value: 'PI-TR-001',
    requested: true,
    note: '',
    visual: { public_ref: 'PI-TR-001', weave_colors: [] as string[] },
  }
  const association = {
    product_id: 'p',
    public_ref: 'PI-TR-001',
    status: 'verified' as const,
    palette_refs: [],
  }
  const data = {
    available: true,
    capabilities: [capability],
    visualAssociations: [association],
  }
  const run = (d = data, s = choice) =>
    evaluateCustomization([target], { [target.key]: [s] }, d)
  expect(run().state).toBe('auto_quote_ready')
  expect(run({ ...data, visualAssociations: [] }).state).toBe(
    'feasibility_review',
  )
  expect(
    run(data, {
      ...choice,
      visual: { ...choice.visual, weave_colors: ['Bleu'] },
    }).state,
  ).toBe('feasibility_review')
  expect(run({ ...data, capabilities: [] }).state).toBe('feasibility_review')
})
