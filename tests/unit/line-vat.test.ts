// TVA ligne par ligne : l'acheteur doit lire ce que coûte CHAQUE produit TTC,
// pas seulement un total en bas de page (demande du 18/09/2026).
import { describe, expect, it } from 'vitest'

import { VAT_RATE, calculateLineVat, type CartItem } from '@/lib/order'

function line(basePriceHt: number, quantity: number): CartItem {
  return {
    product: { id: 'p', sku: 'P', name: 'P', category: 'chair', basePriceHt },
    variant: { id: 'v', name: 'V' },
    quantity,
  } as unknown as CartItem
}

describe('TVA par ligne', () => {
  it('donne le prix unitaire TTC et le total de ligne TTC', () => {
    const vat = calculateLineVat(line(89, 25))

    expect(vat.unitHt).toBe(89)
    expect(vat.unitTtc).toBe(106.8)
    expect(vat.lineHt).toBe(2225)
    expect(vat.lineVat).toBe(445)
    expect(vat.lineTtc).toBe(2670)
  })

  it('arrondit au centime, sans traîne de virgule flottante', () => {
    // 73,85 × 1,2 = 88,619999… en IEEE754.
    const vat = calculateLineVat(line(73.85, 50))

    expect(vat.unitTtc).toBe(88.62)
    expect(vat.lineHt).toBe(3692.5)
    expect(vat.lineVat).toBe(738.5)
    expect(vat.lineTtc).toBe(4431)
  })

  it('reste cohérent : HT + TVA = TTC, sur chaque ligne', () => {
    for (const [prix, qte] of [
      [62.11, 25],
      [103.27, 30],
      [1225, 10],
      [59.09, 70],
    ] as const) {
      const vat = calculateLineVat(line(prix, qte))
      expect(vat.lineHt + vat.lineVat).toBeCloseTo(vat.lineTtc, 2)
    }
  })

  it('applique le même taux que le serveur', () => {
    expect(VAT_RATE).toBe(0.2)
  })

  it('tient une ligne à zéro sans produire NaN', () => {
    const vat = calculateLineVat(line(0, 0))
    expect(vat).toEqual({
      unitHt: 0,
      unitTtc: 0,
      lineHt: 0,
      lineVat: 0,
      lineTtc: 0,
    })
  })
})
