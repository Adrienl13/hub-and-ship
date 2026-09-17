import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { calculateContainerFill, calculateOrder } from '@/lib/order'
import { PRODUCTS } from '@/lib/products'
import { buildQuoteHTML } from './quote'

const chair = PRODUCTS.find((product) => product.category === 'chair')!

describe('quote html builder', () => {
  it('prints the active requested container format', () => {
    const items = [
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 400,
      },
    ]
    const html = buildQuoteHTML({
      items,
      totals: calculateOrder(items),
      fillPercent: 52,
      usedCbm: calculateContainerFill(items, 66).usedCbm,
      capacity: 66,
      containerRef: 'CC-2026-001',
      port: 'Marseille-Fos',
      containerType: '40_hc',
    })

    expect(html).toContain('40&#x27; High Cube')
    expect(html).toContain('32.00 / 66 m³')
    expect(html).not.toContain('CC-2026-001 — 20&#x27; High Cube')
  })

  it('escapes buyer data before injecting it into the printable document', () => {
    const items = [
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 50,
      },
    ]
    const html = buildQuoteHTML({
      items,
      totals: calculateOrder(items),
      fillPercent: 13,
      usedCbm: calculateContainerFill(items, 32).usedCbm,
      capacity: 32,
      containerRef: 'CC-2026-001',
      port: 'Marseille-Fos',
      containerType: '20_hc',
      buyer: {
        company: '<script>alert(1)</script>',
        name: 'Adrien & Co',
        email: 'direction@example.fr',
      },
    })

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Adrien &amp; Co')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it("aligne les pourcentages de l'échéancier sur les montants imprimés", () => {
    // Petite commande : le plancher de 150 € mord, l'acompte ne vaut plus 27 %.
    const smallChair = { ...chair, basePriceHt: 59 }
    const items = [
      {
        product: smallChair,
        variant: getDefaultVariant(smallChair),
        quantity: 50,
      },
    ]
    const html = buildQuoteHTML({
      items,
      totals: calculateOrder(items),
      fillPercent: 13,
      usedCbm: calculateContainerFill(items, 32).usedCbm,
      capacity: 32,
      containerRef: 'CC-2026-001',
      port: 'Marseille-Fos',
      containerType: '20_hc',
    })

    expect(html).toContain('Acompte 25 % (à 80 % remplissage)')
    expect(html).toContain('Frais de réservation 5 %')
    expect(html).not.toContain('Acompte 27 %')
  })
})
