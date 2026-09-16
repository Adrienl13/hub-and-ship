import { describe, expect, it } from 'vitest'

import { liveHomeCards, splitDisplayName } from './model.js'

describe('splitDisplayName', () => {
  it('sépare le type du nom de modèle en capitales', () => {
    expect(splitDisplayName('Chaise de bistrot ODEON')).toEqual({
      title: 'Odeon',
      kind: 'chaise de bistrot',
    })
    expect(splitDisplayName('Salon de terrasse cordage PORTO-VECCHIO')).toEqual({
      title: 'Porto-Vecchio',
      kind: 'salon de terrasse cordage',
    })
    expect(splitDisplayName('Chaise de bistrot SAINT-MALO')).toEqual({
      title: 'Saint-Malo',
      kind: 'chaise de bistrot',
    })
    expect(splitDisplayName('Chaise ELOP')).toEqual({ title: 'Elop', kind: 'chaise' })
  })

  it('garde le nom court quand aucun modèle en capitales ne termine le nom', () => {
    expect(splitDisplayName('Chaise Chevron', 'Chaise')).toEqual({
      title: 'Chaise Chevron',
      kind: 'chaise',
    })
    expect(splitDisplayName('ODEON', 'Chaise')).toEqual({ title: 'ODEON', kind: 'chaise' })
  })
})

describe('liveHomeCards', () => {
  const products = [
    { ref: 'BIS-001', name: 'Chaise de bistrot RIVOLI - chevron', shortName: 'Chaise de bistrot RIVOLI', cat: 'Chaise', kind: 'Chaise', img: 'https://x/a.webp' },
    { ref: 'SKU-999', name: 'Chaise sans photo', shortName: 'Chaise sans photo', cat: 'Chaise', kind: 'Chaise', img: '' },
    { ref: 'ROP-005', name: 'Fauteuil de terrasse CASSIS - tressage', shortName: 'Fauteuil de terrasse CASSIS', cat: 'Fauteuil', kind: 'Fauteuil', img: 'https://x/b.webp' },
    { ref: 'SKU-508', name: 'Salon de terrasse cordage MENERBES - cordage bordeaux', shortName: 'Salon de terrasse cordage MENERBES', cat: 'Salon & lounge', kind: 'Salon & lounge', img: 'https://x/c.webp' },
    { ref: 'SKU-854', name: 'Plateau de table LOURMARIN - rond Ø60', shortName: 'Plateau de table LOURMARIN', cat: 'Table', kind: 'Plateau', img: 'https://x/d.webp' },
    ...['A', 'B', 'C', 'D'].map((k) => ({ ref: `BIS-00${k}`, name: `Chaise de bistrot ${k}${k}`, shortName: `Chaise de bistrot ${k}${k}`, cat: 'Chaise', kind: 'Chaise', img: `https://x/${k}.webp` })),
  ]

  it('filtre par onglet, ignore les produits sans photo et relie chaque carte à sa fiche', () => {
    expect(liveHomeCards(products, 'Fauteuils')).toEqual([
      { name: 'Cassis', kind: 'fauteuil de terrasse', img: 'https://x/b.webp', href: '/catalogue#produit-ROP-005' },
    ])
    expect(liveHomeCards(products, 'Lounge')).toEqual([
      { name: 'Menerbes', kind: 'salon de terrasse cordage', img: 'https://x/c.webp', href: '/catalogue#produit-SKU-508' },
    ])
    expect(liveHomeCards(products, 'Tables')[0]).toMatchObject({ name: 'Lourmarin', kind: 'plateau de table' })
  })

  it('limite à quatre cartes par onglet, dans l’ordre du catalogue', () => {
    const chairs = liveHomeCards(products, 'Chaises')
    expect(chairs).toHaveLength(4)
    expect(chairs.map((c) => c.href)).toEqual([
      '/catalogue#produit-BIS-001',
      '/catalogue#produit-BIS-00A',
      '/catalogue#produit-BIS-00B',
      '/catalogue#produit-BIS-00C',
    ])
    expect(liveHomeCards(products, 'Inconnu')).toEqual([])
  })
})
