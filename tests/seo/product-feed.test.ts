import { describe, expect, it } from 'vitest'

import { buildProductFeed } from '@/routes/product-feed[.]xml'

describe('Google Merchant product feed (C7)', () => {
  it('emits a valid Merchant feed without price-distorting attributes', async () => {
    const xml = await buildProductFeed('2026-10-11')

    // image_link doit être ABSOLU (Merchant rejette les chemins relatifs).
    const imageLinks = [...xml.matchAll(/<g:image_link>([^<]+)<\/g:image_link>/g)]
    expect(imageLinks.length).toBeGreaterThan(0)
    for (const match of imageLinks) {
      expect(match[1]?.startsWith('https://')).toBe(true)
    }

    // multipack détournait le MOQ et faussait le prix (prix unitaire présenté
    // comme prix d'un pack de N) → interdit.
    expect(xml).not.toContain('<g:multipack>')

    // preorder exige une date de disponibilité.
    expect(xml).toContain('<g:availability>preorder</g:availability>')
    expect(xml).toContain('<g:availability_date>2026-10-11</g:availability_date>')

    // Pas de GTIN/MPN → identifier_exists=no évite le rejet.
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>')

    // Prix HT professionnel en EUR, jamais les prix nets partenaires.
    expect(xml).toMatch(/<g:price>\d+\.\d{2} EUR<\/g:price>/)
    expect(xml).toContain('<g:brand>Container Club</g:brand>')
  })
})
