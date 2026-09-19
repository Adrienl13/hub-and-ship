import { describe, expect, it } from 'vitest'

import {
  normalizeSearchText,
  scoreProductMatch,
  sortByRelevance,
  type SearchableProduct,
} from './search'

const PIETEMENT: SearchableProduct = {
  sku: 'TBA-008',
  name: 'Piètement de table VENTOUX - plateau rabattable',
  description: 'Piètement en acier, plateau rabattable pour terrasse.',
  category: 'table_base',
}

const MENERBES: SearchableProduct = {
  sku: 'SKU-508',
  name: 'Salon de terrasse cordage MENERBES - cordage bordeaux, coussins rose poudré',
  description: 'Salon quatre pièces, cordage outdoor teinté dans la masse.',
  category: 'lounge',
}

const ATHENES: SearchableProduct = {
  sku: 'ROP-031',
  name: 'Chaise de terrasse ATHENES - cordage outdoor',
  description: 'Assise cordage, structure aluminium.',
  category: 'lounge',
}

const CATALOGUE = [PIETEMENT, MENERBES, ATHENES]

function trouve(query: string): string[] {
  const matching = CATALOGUE.filter(
    (product) => scoreProductMatch(product, query, product.category) !== null,
  )
  return sortByRelevance(
    matching,
    (product) => scoreProductMatch(product, query, product.category) ?? 0,
  ).map((product) => product.sku)
}

describe('recherche du catalogue admin', () => {
  it('ignore les accents dans les deux sens', () => {
    // Le catalogue est plein de « Piètement », « poudré », « ATHÈNES » :
    // personne ne compose un accent dans un champ de recherche.
    expect(trouve('pietement')).toContain('TBA-008')
    expect(trouve('piètement')).toContain('TBA-008')
    expect(normalizeSearchText('ATHÈNES')).toBe('athenes')
  })

  it('accepte les mots dans le désordre', () => {
    // Les noms sont longs et composés : la sous-chaîne exacte
    // « menerbes salon » n'existe nulle part dans la fiche.
    expect(trouve('menerbes salon')).toEqual(['SKU-508'])
    expect(trouve('salon menerbes')).toEqual(['SKU-508'])
  })

  it('exige TOUS les mots — préciser doit réduire, jamais élargir', () => {
    expect(trouve('salon')).toEqual(['SKU-508'])
    expect(trouve('salon ventoux')).toEqual([])
  })

  it('remonte le SKU exact en tête', () => {
    // Taper une référence, c'est désigner une fiche, pas lancer un mot-clé.
    expect(trouve('rop-031')[0]).toBe('ROP-031')
    expect(trouve('ROP-031')[0]).toBe('ROP-031')
  })

  it('préfère un mot entier du nom à un fragment', () => {
    const entier = scoreProductMatch(MENERBES, 'menerbes', 'lounge')
    const fragment = scoreProductMatch(MENERBES, 'enerbe', 'lounge')
    expect(entier).not.toBeNull()
    expect(fragment).not.toBeNull()
    expect(entier!).toBeGreaterThan(fragment!)
  })

  it('préfère le nom à la description', () => {
    // « cordage » est dans le nom de MENERBES et d'ATHENES, et dans la
    // description des deux : le classement doit rester stable et motivé.
    const parNom = scoreProductMatch(ATHENES, 'athenes', 'lounge')
    const parDescription = scoreProductMatch(ATHENES, 'aluminium', 'lounge')
    expect(parNom!).toBeGreaterThan(parDescription!)
  })

  it('trouve par libellé de catégorie', () => {
    expect(scoreProductMatch(PIETEMENT, 'piètement', 'Piètement')).not.toBeNull()
  })

  it('une requête vide ne filtre rien', () => {
    expect(scoreProductMatch(MENERBES, '', 'lounge')).toBe(0)
    expect(scoreProductMatch(MENERBES, '   ', 'lounge')).toBe(0)
  })

  it('conserve l’ordre d’entrée à score égal', () => {
    // Une liste qui se réarrange entre deux fiches également pertinentes se
    // lit mal : l'admin perd la fiche qu'il visait des yeux.
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(sortByRelevance(rows, () => 1).map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})
