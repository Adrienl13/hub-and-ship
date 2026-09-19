import { describe, expect, it } from 'vitest'

import {
  formatProductDimensions,
  parseComposition,
  productCompositionLines,
} from './products'

describe('formatProductDimensions', () => {
  it('affiche L × l × H pour un produit rectangulaire (ou sans forme)', () => {
    expect(
      formatProductDimensions({ dimensions: { l: 120, w: 70, h: 75 } }),
    ).toBe('120 × 70 × 75 cm')
    expect(
      formatProductDimensions({
        dimensions: { l: 120, w: 70, h: 75 },
        tableShape: 'rectangular',
      }),
    ).toBe('120 × 70 × 75 cm')
    expect(
      formatProductDimensions({
        dimensions: { l: 55, w: 58, h: 85 },
        tableShape: null,
      }),
    ).toBe('55 × 58 × 85 cm')
  })

  it('affiche Ø diamètre × H pour une table ronde (l = diamètre)', () => {
    expect(
      formatProductDimensions({
        dimensions: { l: 80, w: 80, h: 75 },
        tableShape: 'round',
      }),
    ).toBe('Ø 80 × H 75 cm')
  })

  it("n'affiche rien tant que les dimensions ne sont pas saisies", () => {
    expect(formatProductDimensions({ dimensions: { l: 0, w: 0, h: 0 } })).toBe(
      '',
    )
    expect(
      formatProductDimensions({ dimensions: { l: 48, w: 0, h: 86 } }),
    ).toBe('')
    expect(
      formatProductDimensions({
        dimensions: { l: 0, w: 0, h: 0 },
        tableShape: 'round',
      }),
    ).toBe('')
  })
})

describe('composition d’un ensemble', () => {
  const SALON = [
    { label: 'Canapé 3 places', qty: 1, l: 180, w: 80, h: 70 },
    { label: 'Fauteuil', qty: 2, l: 70, w: 70, h: 70 },
    { label: 'Table basse', qty: 1, l: 90, w: 50, h: 40 },
  ]

  it('annonce le nombre de meubles plutôt que des cotes qui ne décrivent rien', () => {
    // Le cas ROP-031 : un salon tarifé en ensemble qui affichait
    // 52 × 60 × 82 — les cotes d'une seule chaise sur quatre meubles.
    expect(
      formatProductDimensions({
        dimensions: { l: 52, w: 60, h: 82 },
        composition: SALON,
      }),
    ).toBe('Ensemble 4 pièces')
  })

  it('compte les quantités, pas les lignes', () => {
    expect(
      formatProductDimensions({
        dimensions: { l: 0, w: 0, h: 0 },
        composition: [{ label: 'Chaise', qty: 1, l: 45, w: 50, h: 90 }],
      }),
    ).toBe('Ensemble 1 pièce')
  })

  it('laisse les cotes parler pour un produit d’une seule pièce', () => {
    expect(
      formatProductDimensions({
        dimensions: { l: 120, w: 70, h: 75 },
        composition: null,
      }),
    ).toBe('120 × 70 × 75 cm')
  })

  it('détaille chaque meuble avec ses propres cotes', () => {
    expect(productCompositionLines({ composition: SALON })).toEqual([
      { label: 'Canapé 3 places', dimensions: '180 × 80 × 70 cm' },
      { label: '2 × Fauteuil', dimensions: '70 × 70 × 70 cm' },
      { label: 'Table basse', dimensions: '90 × 50 × 40 cm' },
    ])
  })

  it('rejette une composition à moitié saisie plutôt que d’en afficher la moitié', () => {
    // Tout ou rien : une pièce sans hauteur rendrait la fiche plus trompeuse
    // que pas de composition du tout.
    expect(
      parseComposition([
        { label: 'Canapé', qty: 1, l: 180, w: 80, h: 70 },
        { label: 'Fauteuil', qty: 2, l: 70, w: 70 },
      ]),
    ).toBeNull()
    expect(parseComposition([])).toBeNull()
    expect(parseComposition(null)).toBeNull()
    expect(parseComposition('salon 4 pièces')).toBeNull()
  })

  it('accepte une composition complète venue de la base', () => {
    expect(parseComposition(SALON)).toEqual(SALON)
  })
})
