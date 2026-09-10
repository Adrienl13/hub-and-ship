import { it, expect } from 'vitest'
import {
  capabilitySchema,
  evaluateCustomization,
  EMPTY_CAPABILITIES,
  lineTargets,
  seatKey,
  sanitizeCustomization,
  withCustomizationState,
  type CustomizationCapability,
  type CustomerSelection,
} from './customization'
import { item, seat } from './fixtures.test-helpers'
import { customizationBrief } from './customization-brief'
const target = lineTargets('test', 60, { seat: 'chair' })[1]!
const cap: CustomizationCapability = {
  id: 'c',
  scope: 'seat',
  product_id: 'chair',
  kind: 'structure_color',
  status: 'verified',
  values: ['Bleu vérifié'],
  allows_free_text: false,
  requires_review: false,
  min_quantity: 50,
  max_quantity: null,
}
const selection: CustomerSelection = {
  kind: 'structure_color',
  value: 'Bleu vérifié',
  note: '',
  requested: false,
}
const run = (
  c: CustomizationCapability = cap,
  s: CustomerSelection = selection,
) =>
  evaluateCustomization(
    [target],
    { [target.key]: [s] },
    { available: true, capabilities: [c] },
  )
it('couleur structure vérifiée conserve le devis possible sans prix ajouté', () => {
  expect(run()).toMatchObject({
    state: 'auto_quote_ready',
    canSend: true,
    selections: [{ status: 'verified', review: false }],
  })
  expect(withCustomizationState('auto_quote_ready', run().state)).toBe(
    'auto_quote_ready',
  )
  expect(JSON.stringify(run())).not.toMatch(/price|cost|delay|lead_time/i)
})
it('rope_color sur demande exige un devis manuel', () => {
  expect(
    run(
      { ...cap, kind: 'rope_color', status: 'on_request' },
      { ...selection, kind: 'rope_color' },
    ).state,
  ).toBe('manual_quote_required')
})
it('finition plateau vérifiée', () => {
  const t = { ...target, scope: 'tabletop' as const, productId: 'top' }
  expect(
    evaluateCustomization(
      [t],
      { [t.key]: [{ ...selection, kind: 'tabletop_finish' }] },
      {
        available: true,
        capabilities: [
          {
            ...cap,
            scope: 'tabletop',
            product_id: 'top',
            kind: 'tabletop_finish',
          },
        ],
      },
    ).state,
  ).toBe('auto_quote_ready')
})
it.each(['logo_request', 'ral_request', 'custom_dimensions_request'] as const)(
  '%s exige une revue même si capacité vérifiée',
  (kind) => {
    const t = lineTargets('test', 60, {})[0]!
    expect(
      evaluateCustomization(
        [t],
        { [t.key]: [{ kind, value: '', note: '', requested: true }] },
        {
          available: true,
          capabilities: [
            { ...cap, scope: 'line_item', product_id: null, kind },
          ],
        },
      ),
    ).toMatchObject({
      state: 'manual_quote_required',
      special: true,
      canSend: true,
    })
  },
)
it.each(['unknown', 'unavailable'] as const)(
  '%s ne devient jamais confirmé et ne bloque pas le lead',
  (status) => {
    expect(run({ ...cap, status })).toMatchObject({
      state: 'feasibility_review',
      canSend: true,
      selections: [{ status, review: true }],
    })
  },
)
it('valeur inventée, quantité hors plage, doublon et lecture manquante restent inconnus', () => {
  expect(run(cap, { ...selection, value: 'Nom/SKU/image imaginé' }).state).toBe(
    'feasibility_review',
  )
  expect(run({ ...cap, min_quantity: 80 }).state).toBe('feasibility_review')
  for (const data of [
    EMPTY_CAPABILITIES,
    { available: true, capabilities: [cap, cap] },
  ])
    expect(
      evaluateCustomization([target], { [target.key]: [selection] }, data)
        .state,
    ).toBe('feasibility_review')
})
it('aucune personnalisation ne dégrade un projet standard en absence de capacités', () => {
  expect(
    evaluateCustomization([target], {}, EMPTY_CAPABILITIES).state,
  ).toBeNull()
})
it('borne incohérente et mauvaise portée refusées', () => {
  expect(capabilitySchema.safeParse({ ...cap, max_quantity: 20 }).success).toBe(
    false,
  )
  expect(capabilitySchema.safeParse({ ...cap, scope: 'base' }).success).toBe(
    false,
  )
})
it('snapshot ne peut certifier un statut ou conserver un champ de prix', () => {
  expect(
    sanitizeCustomization({
      k: [{ ...selection, status: 'verified', price: 12 }],
    }),
  ).toEqual({ k: [selection] })
})
it('les options ne sont pas transférées à un nouveau produit', () => {
  const next = lineTargets('test', 60, { seat: 'other' })[1]!
  expect(
    evaluateCustomization(
      [next],
      { [target.key]: [selection] },
      { available: true, capabilities: [cap] },
    ).selections,
  ).toEqual([])
})
it('résumé texte conserve demandes, quantité et statut sans déduire du nom', () => {
  const i = item('chair', 60),
    t = lineTargets(seatKey(i), 60, { seat: 'chair' })[1]!
  const brief = customizationBrief(
    [i],
    [],
    new Map([['chair', seat('chair', { name: 'ROPE RAL bleu' })]]),
    { [t.key]: [{ ...selection, value: '', note: 'Mon souhait' }] },
    EMPTY_CAPABILITIES,
  )
  expect(brief).toContain('quantité 60')
  expect(brief).toContain('Mon souhait')
  expect(brief).toContain('À confirmer')
  expect(brief).not.toContain('Validé')
})

it('réservation sans personnalisation conservée, sans preuve de fulfillment inventée', () => {
  const empty = evaluateCustomization([target], {}, EMPTY_CAPABILITIES)
  expect(withCustomizationState('reservation_ready', empty.state)).toBe(
    'reservation_ready',
  )
})
it.each([
  ['verified', 'auto_quote_ready'],
  ['on_request', 'manual_quote_required'],
  ['unknown', 'feasibility_review'],
] as const)('stock confirmé + %s => %s', (status, expected) => {
  expect(
    withCustomizationState('reservation_ready', run({ ...cap, status }).state),
  ).toBe(expected)
})
it('la priorité commerciale historique est conservée', () => {
  expect(withCustomizationState('manual_quote_required', run().state)).toBe(
    'manual_quote_required',
  )
  expect(withCustomizationState('feasibility_review', run().state)).toBe(
    'feasibility_review',
  )
  expect(
    withCustomizationState('manual_quote_required', 'feasibility_review'),
  ).toBe('manual_quote_required')
})
