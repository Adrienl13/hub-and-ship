import { describe, expect, it } from 'vitest'

import { productShortName } from './products'

describe('productShortName', () => {
  it('garde la partie avant le premier tiret entouré d’espaces', () => {
    expect(
      productShortName(
        'Salon de terrasse cordage MENERBES - cordage bordeaux, coussins rose poudré',
      ),
    ).toBe('Salon de terrasse cordage MENERBES')
    expect(
      productShortName('Plateau de table LOURMARIN - rond Ø60 marbre blanc liseré doré'),
    ).toBe('Plateau de table LOURMARIN')
    expect(productShortName('Chaise de bistrot RIVOLI - chevron blanc / gris')).toBe(
      'Chaise de bistrot RIVOLI',
    )
  })

  it('accepte les tirets demi-cadratin et cadratin', () => {
    expect(productShortName('Chaise de bistrot ODEON – tressage')).toBe(
      'Chaise de bistrot ODEON',
    )
    expect(productShortName('Chaise de bistrot ODEON — tressage')).toBe(
      'Chaise de bistrot ODEON',
    )
  })

  it('ne coupe pas un tiret collé (SAINT-MALO, PORTO-VECCHIO) ni un nom sans séparateur', () => {
    expect(
      productShortName('Chaise de bistrot SAINT-MALO - tressage bicolore'),
    ).toBe('Chaise de bistrot SAINT-MALO')
    expect(
      productShortName(
        'Salon de terrasse cordage PORTO-VECCHIO - cordage gris perle, structure effet bois',
      ),
    ).toBe('Salon de terrasse cordage PORTO-VECCHIO')
    expect(productShortName('Chaise ELOP')).toBe('Chaise ELOP')
    expect(productShortName('  Chaise Basse  ')).toBe('Chaise Basse')
  })

  it('rend le nom complet si la partie avant le tiret est vide', () => {
    expect(productShortName(' - tressage')).toBe(' - tressage')
  })
})
