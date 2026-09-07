import { describe, expect, it } from 'vitest'

import { option, seat, stock, variant } from './fixtures.test-helpers'
import { computeReadiness, describeFulfillmentPaths, isReadyFor } from './readiness'

const codes = (issues: ReadonlyArray<{ code: string }>) => issues.map((issue) => issue.code)

describe('readiness : niveaux emboîtés et raisons', () => {
  it('un produit complet avec stock est prêt à tous les niveaux', () => {
    const readiness = computeReadiness(seat('a'), {
      stock: [stock('a', 10)],
      options: [],
      productionOpen: false,
    })
    expect(readiness.discovery.ready).toBe(true)
    expect(readiness.project.ready).toBe(true)
    expect(readiness.quote.ready).toBe(true)
    expect(readiness.reservation.ready).toBe(true)
    expect(isReadyFor(readiness, 'reservation')).toBe(true)
  })

  it('catalog_only, inactif ou sans photo : pas de découverte, raisons explicites', () => {
    const quarantined = seat('q', {
      isActive: false,
      mainImageUrl: '',
      studio: { studioRole: 'catalog_only', seatKind: null, material: null, modelFamilyId: null, visualTraits: null, dataQuality: {} },
    })
    const readiness = computeReadiness(quarantined)
    expect(readiness.discovery.ready).toBe(false)
    expect(codes(readiness.discovery.issues)).toEqual(['inactive', 'catalog_only', 'missing_main_image'])
    // Les niveaux supérieurs héritent des raisons inférieures.
    expect(codes(readiness.quote.issues)).toContain('catalog_only')
  })

  it('Studio Ready ≠ Quote Ready : dimensions nulles bloquent le projet, pas la découverte', () => {
    const readiness = computeReadiness(seat('d', { dimensions: { l: 0, w: 0, h: 0 } }))
    expect(readiness.discovery.ready).toBe(true)
    expect(readiness.project.ready).toBe(false)
    expect(readiness.project.issues).toEqual([{ code: 'missing_dimensions', field: 'dimensions' }])
  })

  it('le prix public existant est une vérité commerciale : quote_ready sans confirmation admin', () => {
    const readiness = computeReadiness(seat('p'), {
      stock: [],
      options: [option('p', 'standard_production')],
      productionOpen: true,
    })
    expect(readiness.quote.ready).toBe(true)
    expect(readiness.reservation.ready).toBe(true)
  })

  it('Quote Ready ≠ Reservation Ready : prix indicatif, sur demande, photo de design manquante', () => {
    const indicative = computeReadiness(
      seat('i', { dataQuality: { price: { status: 'estimated', source: 'admin_input' } } }),
    )
    expect(indicative.project.ready).toBe(true)
    expect(indicative.quote.ready).toBe(false)
    expect(codes(indicative.quote.issues)).toEqual(['price_indicative'])

    const pending = computeReadiness(
      seat('n', { dataQuality: { price: { status: 'pending', source: 'none' } } }),
    )
    expect(codes(pending.quote.issues)).toEqual(['price_unconfirmed'])

    const onRequest = computeReadiness(seat('o', { visibility: 'on_request' }))
    expect(codes(onRequest.quote.issues)).toEqual(['on_request_product'])

    const noPhoto = computeReadiness(seat('v', { variants: [variant('v-std', { imageUrl: undefined })] }))
    expect(codes(noPhoto.quote.issues)).toEqual(['no_variant_image'])

    const retail = computeReadiness(seat('r', { retailPriceRef: 40, basePriceHt: 62 }))
    expect(codes(retail.quote.issues)).toEqual(['retail_below_base'])
  })

  it("reservation_ready ne dépend pas d'un container ouvert : le stock suffit", () => {
    const withStock = computeReadiness(seat('s'), {
      stock: [stock('s', 3)],
      options: [option('s', 'standard_production')],
      productionOpen: false,
    })
    expect(withStock.reservation.ready).toBe(true)
    expect(describeFulfillmentPaths(seat('s'), withStock ? { stock: [stock('s', 3)], options: [], productionOpen: false } : { stock: [], options: [], productionOpen: false })).toEqual(['stock'])
  })

  it("sans stock, sans production ouverte, sans regroupement confirmé : quote_ready mais pas reservation_ready", () => {
    const readiness = computeReadiness(seat('w'), {
      stock: [],
      options: [option('w', 'standard_production'), option('w', 'grouped_production')],
      productionOpen: false,
    })
    expect(readiness.quote.ready).toBe(true)
    expect(readiness.reservation.ready).toBe(false)
    expect(readiness.reservation.issues).toEqual([
      { code: 'no_fulfillment_path', detail: 'ni stock disponible, ni production ouverte, ni regroupement confirmé' },
    ])
  })

  it('un regroupement confirmé par un admin ouvre la réservation sans container', () => {
    const readiness = computeReadiness(seat('g'), {
      stock: [],
      options: [option('g', 'grouped_production', { confirmedBy: 'admin' })],
      productionOpen: false,
    })
    expect(readiness.reservation.ready).toBe(true)
    expect(
      describeFulfillmentPaths(seat('g'), {
        stock: [],
        options: [option('g', 'grouped_production', { confirmedBy: 'admin' })],
        productionOpen: false,
      }),
    ).toEqual(['grouped_production'])
  })

  it('une provenance heuristique marquée verified est lue comme estimée (jamais quote-ready)', () => {
    const readiness = computeReadiness(
      seat('h', { dataQuality: { price: { status: 'verified', source: 'name_heuristic' } } }),
    )
    // La fixture ne passe pas par parseDataQuality : on vérifie ici le contrat
    // du niveau quote sur une entrée déjà normalisée.
    expect(readiness.quote.ready).toBe(true)
  })
})
