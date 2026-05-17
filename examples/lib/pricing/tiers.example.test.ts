/**
 * EXAMPLE DE RÉFÉRENCE — Tests Vitest exhaustifs
 * 
 * À adapter pour src/lib/pricing/tiers.test.ts
 * Doit couvrir : nominal, edge cases, précision décimale
 */

import { describe, it, expect } from 'vitest'
import {
  calculateOrderPricing,
  DEFAULT_PRICING_TIERS,
  type CartLineInput,
  type PricingTier,
} from './tiers.example'

// ============================================
// HELPERS DE TEST
// ============================================

const createLine = (overrides: Partial<CartLineInput> = {}): CartLineInput => ({
  productId: 'test-product',
  variantId: 'test-variant',
  quantity: 1,
  cbmPerUnit: 0.1,
  costLanded: 50,
  ecoContribution: 0.5,
  ...overrides,
})

// ============================================
// CAS NOMINAL
// ============================================

describe('calculateOrderPricing — cas nominal', () => {
  it('devrait calculer correctement une ligne simple dans le premier tier', () => {
    const lines = [createLine({ quantity: 5, cbmPerUnit: 0.1, costLanded: 50 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // 5 × 0.1 = 0.5 CBM, donc tier 1 (35%)
    expect(result.totalCbm).toBe(0.5)
    expect(result.effectiveMarginPercent).toBe(35)
    
    // Prix unitaire = 50 × 1.35 + 0.5 = 68
    expect(result.lines[0].unitPriceHt).toBe(68)
    expect(result.lines[0].effectiveMargin).toBe(35)
    
    // Subtotal = 68 × 5 = 340
    expect(result.subtotalHt).toBe(340)
  })

  it('devrait appliquer le tier 2 quand on dépasse 0.80 CBM', () => {
    const lines = [createLine({ quantity: 15, cbmPerUnit: 0.1, costLanded: 50 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // 15 × 0.1 = 1.5 CBM
    // Tier 1 (0-0.80) : 0.80 × 35% = 28
    // Tier 2 (0.80-1.5) : 0.70 × 32% = 22.4
    // Moyenne pondérée : (28 + 22.4) / 1.5 = 33.6%
    expect(result.totalCbm).toBe(1.5)
    expect(result.effectiveMarginPercent).toBeCloseTo(33.6, 1)
  })

  it('devrait appliquer le tier le plus bas pour très gros volume', () => {
    const lines = [createLine({ quantity: 100, cbmPerUnit: 0.1, costLanded: 50 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // 100 × 0.1 = 10 CBM, donc tous tiers traversés
    expect(result.totalCbm).toBe(10)
    expect(result.effectiveMarginPercent).toBeLessThan(35)
    expect(result.effectiveMarginPercent).toBeGreaterThan(25)
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('calculateOrderPricing — edge cases', () => {
  it('devrait retourner un résultat vide pour un panier vide', () => {
    const result = calculateOrderPricing([], DEFAULT_PRICING_TIERS)

    expect(result.lines).toEqual([])
    expect(result.totalCbm).toBe(0)
    expect(result.subtotalHt).toBe(0)
    expect(result.totalHt).toBe(0)
    expect(result.effectiveMarginPercent).toBe(35)  // tier par défaut
  })

  it('devrait gérer une seule unité', () => {
    const lines = [createLine({ quantity: 1, cbmPerUnit: 0.08, costLanded: 45 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    expect(result.totalCbm).toBe(0.08)
    expect(result.effectiveMarginPercent).toBe(35)
    // Prix = 45 × 1.35 + 0.5 = 61.25
    expect(result.lines[0].unitPriceHt).toBeCloseTo(61.25, 2)
  })

  it('devrait gérer plusieurs lignes avec accumulation CBM', () => {
    const lines = [
      createLine({ productId: 'p1', quantity: 10, cbmPerUnit: 0.08, costLanded: 45 }),   // 0.8 CBM
      createLine({ productId: 'p2', quantity: 5, cbmPerUnit: 0.25, costLanded: 95 }),    // 1.25 CBM (total 2.05)
    ]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    expect(result.totalCbm).toBe(2.05)
    expect(result.lines).toHaveLength(2)
    
    // Ligne 1 : entièrement dans tier 1 (35%)
    expect(result.lines[0].effectiveMargin).toBe(35)
    
    // Ligne 2 : commence à 0.80, va jusqu'à 2.05
    // Tier 2 (0.80-2.00) : 1.20 × 32%
    // Tier 3 (2.00-2.05) : 0.05 × 30%
    // Moyenne : (1.20 × 32 + 0.05 × 30) / 1.25
    const expectedMarginLine2 = (1.20 * 32 + 0.05 * 30) / 1.25
    expect(result.lines[1].effectiveMargin).toBeCloseTo(expectedMarginLine2, 2)
  })

  it('devrait gérer une quantité de 0 (filtré normalement par UI)', () => {
    const lines = [createLine({ quantity: 0 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    expect(result.totalCbm).toBe(0)
    expect(result.lines[0].subtotalHt).toBe(0)
  })

  it('devrait gérer un coût de 0 (cas produit "pied seul -30%")', () => {
    const lines = [createLine({ quantity: 5, costLanded: 0, ecoContribution: 1 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // Prix = 0 × 1.35 + 1 = 1
    expect(result.lines[0].unitPriceHt).toBe(1)
    expect(result.subtotalHt).toBe(5)
  })

  it('devrait gérer une eco-contribution de 0', () => {
    const lines = [createLine({ ecoContribution: 0 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    expect(result.ecoContributionTotal).toBe(0)
    expect(result.lines[0].unitPriceHt).toBe(67.5)  // 50 × 1.35
  })
})

// ============================================
// PRÉCISION DÉCIMALE
// ============================================

describe('calculateOrderPricing — précision décimale', () => {
  it('devrait arrondir à 2 décimales (centimes)', () => {
    // Cas qui produirait normalement une longue décimale
    const lines = [createLine({ quantity: 7, cbmPerUnit: 0.0833, costLanded: 33.33 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // Vérifier que tous les montants sont arrondis à 2 décimales
    const isRounded = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001
    
    expect(isRounded(result.subtotalHt)).toBe(true)
    expect(isRounded(result.totalHt)).toBe(true)
    expect(isRounded(result.lines[0].unitPriceHt)).toBe(true)
  })

  it("ne devrait pas avoir d'erreur d'addition flottante sur de nombreuses lignes", () => {
    // 0.1 + 0.2 = 0.30000000000000004 en JS pur
    const lines = Array.from({ length: 100 }, (_, i) =>
      createLine({ productId: `p${i}`, quantity: 1, cbmPerUnit: 0.001, costLanded: 0.10, ecoContribution: 0.10 }),
    )
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // Vérifier exactitude
    expect(Number.isInteger(Math.round(result.subtotalHt * 100))).toBe(true)
  })
})

// ============================================
// VALIDATION TIERS PERSONNALISÉS
// ============================================

describe('calculateOrderPricing — tiers personnalisés', () => {
  it('devrait fonctionner avec des tiers personnalisés', () => {
    const customTiers: PricingTier[] = [
      { minCbm: 0, maxCbm: 1, marginPercent: 50 },
      { minCbm: 1, maxCbm: null, marginPercent: 20 },
    ]
    
    const lines = [createLine({ quantity: 10, cbmPerUnit: 0.1, costLanded: 50 })]
    const result = calculateOrderPricing(lines, customTiers)

    // 10 × 0.1 = 1 CBM, exactement à la frontière
    expect(result.effectiveMarginPercent).toBe(50)
  })

  it('devrait gérer un seul tier (aucune dégressivité)', () => {
    const customTiers: PricingTier[] = [
      { minCbm: 0, maxCbm: null, marginPercent: 30 },
    ]
    
    const lines = [
      createLine({ productId: 'p1', quantity: 1 }),
      createLine({ productId: 'p2', quantity: 50 }),
    ]
    const result = calculateOrderPricing(lines, customTiers)

    expect(result.lines[0].effectiveMargin).toBe(30)
    expect(result.lines[1].effectiveMargin).toBe(30)
  })
})

// ============================================
// COHÉRENCE GLOBALE
// ============================================

describe('calculateOrderPricing — cohérence globale', () => {
  it('la somme des subtotaux devrait égaler le total HT', () => {
    const lines = [
      createLine({ productId: 'p1', quantity: 3 }),
      createLine({ productId: 'p2', quantity: 7 }),
      createLine({ productId: 'p3', quantity: 12 }),
    ]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    const sumOfSubtotals = result.lines.reduce((s, l) => s + l.subtotalHt, 0)
    expect(sumOfSubtotals).toBeCloseTo(result.totalHt, 2)
  })

  it('la marge effective globale devrait être entre les bornes des tiers utilisés', () => {
    const lines = [createLine({ quantity: 60, cbmPerUnit: 0.1, costLanded: 50 })]
    const result = calculateOrderPricing(lines, DEFAULT_PRICING_TIERS)

    // 6 CBM, traverse tiers 1, 2, 3, 4
    expect(result.effectiveMarginPercent).toBeLessThanOrEqual(35)
    expect(result.effectiveMarginPercent).toBeGreaterThanOrEqual(27)
  })
})
