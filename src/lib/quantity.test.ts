import { describe, expect, it } from 'vitest'

import {
  getNextOrderQuantity,
  getPreviousOrderQuantity,
  getQuantityRule,
  sanitizeOrderQuantity,
} from '@/lib/quantity'
import { PRODUCTS } from '@/lib/products'

const chair = PRODUCTS.find((product) => product.category === 'chair')!
const armchair = PRODUCTS.find((product) => product.category === 'armchair')!
const table = PRODUCTS.find((product) => product.category === 'table')!

describe('quantity rules', () => {
  it('lets a colour impose its own minimum (special table-top tints)', () => {
    const rule = getQuantityRule(table, {
      ...table.variants[0]!,
      minOrderUnits: 40,
    })

    expect(rule.minimum).toBe(40)
    expect(rule.step).toBe(1)
    expect(sanitizeOrderQuantity(12, rule)).toBe(40)
    expect(sanitizeOrderQuantity(41, rule)).toBe(41)

    // Assises : le minimum coloris ne descend jamais sous le MOQ du produit
    // et garde les paliers de 10.
    const chairRule = getQuantityRule(chair, {
      ...chair.variants[0]!,
      minOrderUnits: 30,
    })
    expect(chairRule.minimum).toBe(chair.moqUnits)
    expect(chairRule.step).toBe(10)
  })

  it('requires a minimum of 50 units for chairs', () => {
    const rule = getQuantityRule(chair)

    expect(sanitizeOrderQuantity(0, rule)).toBe(0)
    expect(sanitizeOrderQuantity(1, rule)).toBe(50)
    expect(sanitizeOrderQuantity(49, rule)).toBe(50)
    expect(sanitizeOrderQuantity(50, rule)).toBe(50)
  })

  it('rounds chair quantities up to the next pack of 10 after 50', () => {
    const rule = getQuantityRule(chair)

    expect(sanitizeOrderQuantity(51, rule)).toBe(60)
    expect(sanitizeOrderQuantity(59, rule)).toBe(60)
    expect(sanitizeOrderQuantity(60, rule)).toBe(60)
    expect(sanitizeOrderQuantity(61, rule)).toBe(70)
  })

  it('increments and decrements chairs by the business pack size', () => {
    const rule = getQuantityRule(chair)

    expect(getNextOrderQuantity(0, rule)).toBe(50)
    expect(getNextOrderQuantity(50, rule)).toBe(60)
    expect(getPreviousOrderQuantity(60, rule)).toBe(50)
    expect(getPreviousOrderQuantity(50, rule)).toBe(0)
  })

  it('applies the same seat rule to armchairs — start at the product MOQ, then +10', () => {
    const rule = getQuantityRule(armchair)

    expect(rule.minimum).toBe(armchair.moqUnits)
    expect(rule.step).toBe(10)
    expect(sanitizeOrderQuantity(1, rule)).toBe(armchair.moqUnits)
    expect(getNextOrderQuantity(armchair.moqUnits, rule)).toBe(
      armchair.moqUnits + 10,
    )
    expect(getPreviousOrderQuantity(armchair.moqUnits, rule)).toBe(0)
  })

  it('derives the chair minimum from the product MOQ, not a hardcoded 50', () => {
    const rule = getQuantityRule({ ...chair, moqUnits: 30 })

    expect(rule.minimum).toBe(30)
    expect(sanitizeOrderQuantity(1, rule)).toBe(30)
    expect(sanitizeOrderQuantity(31, rule)).toBe(40)
  })

  // Le MOQ est affiché sur la carte, la fiche et le devis : il vaut pour
  // TOUTES les catégories, pas seulement les assises. Avant ce changement,
  // 42 fiches actives (lounge, piètements, bancs, plateaux) annonçaient un
  // minimum de 5 à 70 unités et se laissaient pourtant ajouter à 1 — un devis
  // partait sous le minimum de série.
  it('tient le MOQ des produits hors assise, puis complète à l’unité', () => {
    const rule = getQuantityRule(table)

    expect(rule.minimum).toBe(table.moqUnits)
    expect(rule.step).toBe(1)
    expect(rule.label).toBe(`Min. ${table.moqUnits} puis à l'unité`)
    expect(sanitizeOrderQuantity(1, rule)).toBe(table.moqUnits)
    expect(getNextOrderQuantity(table.moqUnits, rule)).toBe(table.moqUnits + 1)
    expect(getPreviousOrderQuantity(table.moqUnits, rule)).toBe(0)
  })

  it('reste à l’unité quand le produit n’impose aucun minimum', () => {
    const rule = getQuantityRule({ ...table, moqUnits: 1 })

    expect(rule.minimum).toBe(1)
    expect(rule.step).toBe(1)
    expect(sanitizeOrderQuantity(1, rule)).toBe(1)
    expect(getNextOrderQuantity(1, rule)).toBe(2)
    expect(getPreviousOrderQuantity(2, rule)).toBe(1)
  })

  it('nomme la vraie contrainte quand le coloris dépasse le MOQ produit', () => {
    const colour = getQuantityRule(table, {
      ...table.variants[0]!,
      minOrderUnits: table.moqUnits + 20,
    })
    expect(colour.minimum).toBe(table.moqUnits + 20)
    expect(colour.label).toContain('pour ce coloris')

    const series = getQuantityRule(table, {
      ...table.variants[0]!,
      minOrderUnits: 2,
    })
    expect(series.minimum).toBe(table.moqUnits)
    expect(series.label).toBe(`Min. ${table.moqUnits} puis à l'unité`)
  })
})
