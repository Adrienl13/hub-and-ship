import { describe, it, expect } from 'vitest'
import {
  effectiveTableShape,
  resolveTableCompatibility as resolve,
  tableRuleSchema,
  type TableCompatibilityRule,
} from './compatibility'
import { top, base, pair, data } from './table.test-helpers'

it.each([
  ['rectangular', 60, 60, 'square'],
  ['rectangular', 70, 70, 'square'],
  ['rectangular', 120, 80, 'rectangular'],
  ['rectangular', 80, 120, 'rectangular'],
  ['round', 70, 70, 'round'],
  ['rectangular', 70, 70.001, 'rectangular'],
] as const)(
  'forme catalogue %s %s×%s devient %s sans mutation',
  (tableShape, l, w, expected) => {
    const product = {
      ...top,
      tableShape,
      dimensions: { l, w, h: 2 },
      name: 'Rond carré rectangle',
      sku: 'ROUND-SQUARE',
    }
    expect(effectiveTableShape(product)).toBe(expected)
    expect(product.tableShape).toBe(tableShape)
  },
)
it.each([0, -1, NaN, Infinity, undefined, null])(
  'dimension invalide %s reste non confirmée',
  (value) => {
    const product = { ...top, dimensions: { l: value as number, w: 70, h: 2 } }
    expect(effectiveTableShape(product)).toBeNull()
    expect(resolve(product, base, { ...data, rules: [] }).verdict).toBe(
      'requires_confirmation',
    )
  },
)
it('produit ou dimensions absents restent inconnus', () => {
  expect(effectiveTableShape(undefined)).toBeNull()
  const product = { ...top, dimensions: undefined } as unknown as typeof top
  expect(effectiveTableShape(product)).toBeNull()
  expect(resolve(product, base, { ...data, rules: [] }).verdict).toBe(
    'requires_confirmation',
  )
})

// Business examples are synthetic fixtures only: no catalogue bindings or seeds.
const types = ['standard', 'esterel', 'camargue', 'marais'] as const
function rule(
  type: (typeof types)[number],
  shape: 'square' | 'round' | 'rectangular',
): TableCompatibilityRule {
  const allowed =
    type === 'esterel' ? shape === 'rectangular' : shape !== 'rectangular'
  return {
    ...pair,
    id: `${type}-${shape}`,
    base_id: null,
    tabletop_id: null,
    base_type_id: type,
    shape,
    verdict: allowed ? 'allowed' : 'denied',
    min_length_cm:
      allowed && type !== 'esterel' && type !== 'marais'
        ? type === 'standard'
          ? 50
          : 80
        : null,
    min_width_cm:
      allowed && type !== 'esterel' && type !== 'marais'
        ? type === 'standard'
          ? 50
          : 80
        : null,
    max_length_cm:
      allowed && (type === 'standard' || type === 'marais')
        ? type === 'standard'
          ? 80
          : 70
        : null,
    max_width_cm:
      allowed && (type === 'standard' || type === 'marais')
        ? type === 'standard'
          ? 80
          : 70
        : null,
  }
}
describe.each(types)('futurs plateaux — type %s', (type) => {
  it.each(['square', 'round', 'rectangular'] as const)(
    'règle générique %s, sans couple exact',
    (shape) => {
      const rules = (['square', 'round', 'rectangular'] as const).map((s) =>
        rule(type, s),
      )
      for (const size of [49, 50, 60, 70, 80, 81, 140]) {
        const product = {
          ...top,
          id: `future-${shape}-${size}`,
          name: 'Nouveau produit',
          sku: 'sans-indice',
          tableShape:
            shape === 'round' ? ('round' as const) : ('rectangular' as const),
          dimensions: {
            l: size,
            w: shape === 'rectangular' ? size + 20 : size,
            h: 2,
          },
        }
        const result = resolve(product, base, {
          ...data,
          rules,
          baseProfiles: [{ base_id: base.id, base_type_id: type }],
        })
        const allowed =
          type === 'esterel'
            ? shape === 'rectangular'
            : shape !== 'rectangular' &&
              (type === 'standard'
                ? size >= 50 && size <= 80
                : type === 'camargue'
                  ? size >= 80
                  : size <= 70)
        expect(result.verdict).toBe(allowed ? 'allowed' : 'denied')
        expect(tableRuleSchema.safeParse(rule(type, shape)).success).toBe(true)
      }
    },
  )
})
it('square et rectangular ne se couvrent jamais mutuellement', () => {
  for (const [shape, l, w] of [
    ['square', 120, 80],
    ['rectangular', 70, 70],
  ] as const) {
    expect(
      resolve(
        { ...top, dimensions: { l, w, h: 2 } },
        { ...base, compatibleTopShapes: ['rectangular'] },
        {
          ...data,
          rules: [rule('standard', shape)],
          baseProfiles: [{ base_id: base.id, base_type_id: 'standard' }],
        },
      ).verdict,
    ).toBe('requires_confirmation')
  }
})
it('exception exacte prioritaire sur forme et plage, même dimensions absentes', () => {
  for (const verdict of ['allowed', 'denied'] as const) {
    expect(
      resolve({ ...top, dimensions: { l: 0, w: 0, h: 2 } }, base, {
        ...data,
        rules: [rule('standard', 'square'), { ...pair, verdict }],
        baseProfiles: [{ base_id: base.id, base_type_id: 'standard' }],
      }),
    ).toMatchObject({ verdict, reason: 'verified_pair' })
  }
})
