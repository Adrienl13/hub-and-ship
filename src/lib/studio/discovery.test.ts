import { describe, expect, it } from 'vitest'

import { buildDiscoveryPool, cardImageUrl, isDiscoverySeat, seatSpecLine } from './discovery'
import { confirmedOption, item, option, seat, stock, variant } from './fixtures.test-helpers'
import { describeQuantity } from './quantity-feedback'

const base = { curationSets: [], diagnosticPairs: [] }

describe('découverte : assises discovery_ready seulement', () => {
  it('exclut catalog_only, inactif, sans image, et les plateaux', () => {
    const products = [
      seat('ok'),
      seat('quarantined', { studio: { studioRole: 'catalog_only', seatKind: null, material: null, modelFamilyId: null, visualTraits: null, dataQuality: {} } }),
      seat('inactive', { isActive: false }),
      seat('noimage', { mainImageUrl: '' }),
      seat('top', { category: 'table_top', studio: { studioRole: 'tabletop', seatKind: null, material: 'hpl', modelFamilyId: null, visualTraits: null, dataQuality: {} } }),
    ]
    expect(products.filter(isDiscoverySeat).map((p) => p.id)).toEqual(['ok'])
    const pool = buildDiscoveryPool({ products, ...base })
    expect(pool.seats.map((s) => s.id)).toEqual(['ok'])
    expect(pool.engineCatalogue.seats).toEqual([{ id: 'ok', material: 'pe_weave', seatKind: 'chair', familyId: null }])
    expect(pool.curationSet).toBeNull()
    expect(pool.curationMissing).toBe(false)
  })

  it('ne limite jamais artificiellement le nombre d’assises', () => {
    const products = Array.from({ length: 120 }, (_, index) => seat(`s-${index}`))
    expect(buildDiscoveryPool({ products, ...base }).seats).toHaveLength(120)
  })

  it('?set=pilot restreint au jeu ACTIF déclaré en base', () => {
    const products = [seat('a'), seat('b'), seat('c')]
    const pool = buildDiscoveryPool(
      { products, curationSets: [{ id: 'pilot', label: 'Pilote', productIds: ['b', 'c', 'inconnu'] }], diagnosticPairs: [] },
      { set: 'pilot' },
    )
    expect(pool.seats.map((s) => s.id)).toEqual(['b', 'c'])
    expect(pool.curationSet?.id).toBe('pilot')
    expect(pool.curationMissing).toBe(false)
  })

  it('sans jeu pilote valide : découverte complète et signal explicite, aucune donnée inventée', () => {
    const products = [seat('a'), seat('b')]
    const missing = buildDiscoveryPool({ products, ...base }, { set: 'pilot' })
    expect(missing.seats.map((s) => s.id)).toEqual(['a', 'b'])
    expect(missing.curationSet).toBeNull()
    expect(missing.curationMissing).toBe(true)
    const empty = buildDiscoveryPool(
      { products, curationSets: [{ id: 'pilot', label: 'Vide', productIds: ['zzz'] }], diagnosticPairs: [] },
      { set: 'pilot' },
    )
    expect(empty.curationMissing).toBe(true)
    expect(empty.seats).toHaveLength(2)
  })

  it('les familles ne sont transmises au moteur que vérifiées (aucune liste au lot 2 → null)', () => {
    const products = [seat('f', { studio: { studioRole: 'seat', seatKind: 'chair', material: 'rope', modelFamilyId: 'fam', visualTraits: null, dataQuality: {} } })]
    expect(buildDiscoveryPool({ products, ...base }).engineCatalogue.seats[0]?.familyId).toBeNull()
  })

  it('spécification et image viennent de la base, sans transformation', () => {
    expect(seatSpecLine(seat('a'))).toBe('48 × 56 × 86 cm')
    expect(seatSpecLine(seat('w', { dimensions: { l: 0, w: 0, h: 0 }, weightKg: 4.3 }))).toBe('4.3 kg')
    expect(seatSpecLine(seat('n', { dimensions: { l: 0, w: 0, h: 0 }, weightKg: 0 }))).toBeNull()
    const product = seat('i', { variants: [variant('i-a', { imageUrl: '/a.webp' }), variant('i-b', { imageUrl: undefined })] })
    expect(cardImageUrl(product)).toBe('/a.webp')
    expect(cardImageUrl(product, 'i-b')).toBe('/img/i.webp')
  })
})

describe('retour de quantité : 6 unités, MOQ 50', () => {
  const product = seat('chair')

  it('cas A — stock réel suffisant → « Disponible en stock », on continue', () => {
    const feedback = describeQuantity(item('chair', 6), product, { stock: [stock('chair', 10)], options: [] })
    expect(feedback.tone).toBe('confirmed')
    expect(feedback.title).toBe('Disponible en stock')
    expect(feedback.resolution.mode).toBe('stock')
    expect(feedback.ruleLabel).toBe('Min. 50 puis +10')
  })

  it('cas B — ni stock ni voie confirmée → « Quantité sous le minimum de série : nous étudions la faisabilité »', () => {
    const feedback = describeQuantity(item('chair', 6), product, { stock: [], options: [option('chair', 'standard_production')] })
    expect(feedback.tone).toBe('review')
    expect(feedback.title).toBe('Quantité sous le minimum de série (50) : nous étudions la faisabilité')
    expect(feedback.detail).toContain('Vous pouvez continuer avec 6')
    expect(feedback.resolution.reasons).toEqual(['below_moq'])
  })

  it('stock partiel : jamais « disponible » pour 6 si 4 en stock', () => {
    const feedback = describeQuantity(item('chair', 6), product, { stock: [stock('chair', 4)], options: [] })
    expect(feedback.tone).toBe('review')
    expect(feedback.title).toContain('nous étudions la faisabilité')
    expect(feedback.detail).toContain('4 unités en stock, insuffisant pour 6')
  })

  it('50 unités sur une seed non confirmée → devis possible, production à confirmer ; confirmée → confirmé', () => {
    const unconfirmed = describeQuantity(item('chair', 50), product, { stock: [], options: [option('chair', 'standard_production')] })
    expect(unconfirmed.tone).toBe('quote')
    expect(unconfirmed.title).toBe('Série standard connue, production à confirmer')
    const confirmed = describeQuantity(item('chair', 50), product, { stock: [], options: [confirmedOption('chair', 'standard_production')] })
    expect(confirmed.tone).toBe('confirmed')
    expect(confirmed.title).toBe('Production standard confirmée')
  })

  it('personnalisation et produit sur demande → confirmation usine / devis manuel', () => {
    expect(describeQuantity(item('chair', 60, { customColour: true }), product, { stock: [], options: [] }).title).toBe('Personnalisation : confirmation usine')
    expect(describeQuantity(item('or', 60), seat('or', { visibility: 'on_request' }), { stock: [], options: [] }).title).toBe('Produit sur demande : devis manuel')
  })
})
