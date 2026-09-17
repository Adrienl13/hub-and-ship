import { describe, expect, it } from 'vitest'

import { CHANNEL_COEFFICIENTS } from './channel'
import {
  DISCOUNT_FAMILIES,
  DISCOUNT_FAMILY_LABEL,
  MAX_VOLUME_DISCOUNT_PERCENT,
  countUnitsByFamily,
  resolveDiscountFamily,
} from './discount-families'
import { PRODUCT_CATEGORIES } from '@/lib/products'

describe('familles de remise', () => {
  it('range chaque catégorie du catalogue dans une famille', () => {
    for (const category of PRODUCT_CATEGORIES) {
      const family = resolveDiscountFamily(category)
      expect(DISCOUNT_FAMILIES).toContain(family)
      // Aucune catégorie existante ne doit tomber dans le filet de sécurité :
      // « autres » est réservé à une catégorie ajoutée en base avant le code.
      expect(family).not.toBe('autres')
    }
  })

  it('regroupe assises, tables et salons comme on les achète', () => {
    expect(resolveDiscountFamily('chair')).toBe('assises')
    expect(resolveDiscountFamily('armchair')).toBe('assises')
    expect(resolveDiscountFamily('bench')).toBe('assises')
    // Plateau et piètement partent du même atelier et se commandent ensemble.
    expect(resolveDiscountFamily('table')).toBe('tables')
    expect(resolveDiscountFamily('table_top')).toBe('tables')
    expect(resolveDiscountFamily('table_base')).toBe('tables')
    expect(resolveDiscountFamily('lounge')).toBe('salons')
  })

  it('ne plante pas sur une catégorie inconnue de la base', () => {
    expect(resolveDiscountFamily('parasol')).toBe('autres')
    expect(resolveDiscountFamily('')).toBe('autres')
  })

  it('compte les pièces famille par famille', () => {
    const counts = countUnitsByFamily([
      { category: 'chair', quantity: 60 },
      { category: 'armchair', quantity: 40 },
      { category: 'table_top', quantity: 12 },
      { category: 'lounge', quantity: 4 },
    ])
    expect(counts).toEqual({ assises: 100, tables: 12, salons: 4, autres: 0 })
  })

  it('ignore les quantités négatives ou fractionnaires', () => {
    const counts = countUnitsByFamily([
      { category: 'chair', quantity: -5 },
      { category: 'chair', quantity: 2.7 },
    ])
    expect(counts.assises).toBe(2)
  })

  it('nomme chaque famille', () => {
    for (const family of DISCOUNT_FAMILIES) {
      expect(DISCOUNT_FAMILY_LABEL[family].length).toBeGreaterThan(0)
    }
  })
})

describe('plafond de remise — règle d’or du multi-canal', () => {
  it('reste sous le prix revendeur ET sous le prix distributeur', () => {
    // Si une remise volume descendait sous le coefficient d'un canal
    // partenaire, un client direct paierait moins cher qu'un revendeur : c'est
    // l'invariant que le plafond protège.
    const ceiling = MAX_VOLUME_DISCOUNT_PERCENT / 100
    expect(ceiling).toBeLessThan(1 - CHANNEL_COEFFICIENTS.revendeur)
    expect(ceiling).toBeLessThan(1 - CHANNEL_COEFFICIENTS.distributeur)
  })

  it('laisse malgré tout de la marge au-dessus de la grille actuelle', () => {
    expect(MAX_VOLUME_DISCOUNT_PERCENT).toBeGreaterThan(10)
  })
})
