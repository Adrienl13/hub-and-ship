// Régression : l'« économie » se calculait sur TOUTES les lignes, y compris
// celles dont le prix de référence est absent ou passe sous le prix
// Terrassea. Trois fiches de production étaient dans ce cas — le récapitulatif
// de réservation et le devis PDF affichaient « Économie --4 365 € (-111 %) »
// au moment de confirmer, double moins compris.
import { describe, expect, it } from 'vitest'

import { calculateOrder, type CartItem } from '@/lib/order'

function line(
  basePriceHt: number,
  retailPriceRef: number,
  quantity: number,
  id = 'p',
): CartItem {
  return {
    product: {
      id,
      sku: id.toUpperCase(),
      name: id,
      category: 'chair',
      basePriceHt,
      retailPriceRef,
      ecoContribution: 0,
      cbmPerUnit: 0.08,
      moqUnits: quantity,
      weightKg: 4,
    },
    variant: { id: `${id}-v`, name: 'V' },
    quantity,
  } as unknown as CartItem
}

describe('économie affichée au client', () => {
  it('reste positive quand le prix de référence est sous le prix Terrassea', () => {
    // ROP-001 : 1 659 € HT pour une référence à 786 €.
    const totals = calculateOrder([line(1659, 786, 5)])
    expect(totals.savings).toBe(0)
    expect(totals.retailReference).toBe(0)
    expect(totals.savingsPercent).toBe(0)
  })

  it('reste positive quand le prix de référence est absent', () => {
    // SKU-336 : référence à 0 €.
    const totals = calculateOrder([line(73.85, 0, 50)])
    expect(totals.savings).toBe(0)
    expect(totals.retailReference).toBe(0)
  })

  it('ne compte que les lignes comparables dans un panier mixte', () => {
    // 10 × (149 → 89) économise 600 €. La ligne sans référence ne doit ni
    // gonfler l'équivalent retail ni ronger l'économie de l'autre ligne.
    const totals = calculateOrder([
      line(89, 149, 10, 'comparable'),
      line(1659, 786, 5, 'sansref'),
    ])
    expect(totals.retailReference).toBe(1490)
    expect(totals.savings).toBe(600)
    expect(totals.totalHt).toBe(89 * 10 + 1659 * 5)
  })

  it('répartit la remise volume au prorata des lignes comparables', () => {
    // 150 unités déclenchent la remise volume : l'économie doit inclure la
    // remise appliquée à la ligne comparable, pas celle du panier entier.
    const totals = calculateOrder([line(89, 149, 150, 'comparable')])
    expect(totals.volumeDiscountPercent).toBeGreaterThan(0)
    expect(totals.savings).toBeCloseTo(149 * 150 - totals.totalHt, 2)
  })

  it('calcule normalement un panier entièrement comparable', () => {
    const totals = calculateOrder([line(89, 149, 10)])
    expect(totals.retailReference).toBe(1490)
    expect(totals.savings).toBe(600)
    expect(totals.savingsPercent).toBeCloseTo((600 / 1490) * 100, 5)
  })

  it('ne casse pas sur un panier vide', () => {
    const totals = calculateOrder([])
    expect(totals.savings).toBe(0)
    expect(totals.retailReference).toBe(0)
    expect(totals.savingsPercent).toBe(0)
  })
})
