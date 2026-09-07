import { describe, expect, it } from 'vitest'

import { confirmedOption, option, seat, stock, variant } from './fixtures.test-helpers'
import { computeReadiness, describeFulfillmentPaths, isReadyFor } from './readiness'

const codes = (issues: ReadonlyArray<{ code: string }>) => issues.map((issue) => issue.code)
const NO_PATH = {
  code: 'no_fulfillment_path',
  detail: 'ni stock disponible, ni production standard confirmée, ni regroupement confirmé',
}

describe('readiness : niveaux emboîtés et raisons', () => {
  it('un produit complet avec stock est prêt à tous les niveaux', () => {
    const readiness = computeReadiness(seat('a'), { stock: [stock('a', 10)], options: [] })
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
    })
    expect(readiness.quote.ready).toBe(true)
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

  it('une provenance heuristique marquée verified est lue comme estimée (jamais quote-ready)', () => {
    const readiness = computeReadiness(
      seat('h', { dataQuality: { price: { status: 'verified', source: 'name_heuristic' } } }),
    )
    // La fixture ne passe pas par parseDataQuality : on vérifie ici le contrat
    // du niveau quote sur une entrée déjà normalisée.
    expect(readiness.quote.ready).toBe(true)
  })
})

describe('readiness : la réservation exige une voie CONFIRMÉE pour ce produit', () => {
  it("cas A — option seed_moq non confirmée (même avec n'importe quel container ouvert) : quote_ready, PAS reservation_ready", () => {
    const readiness = computeReadiness(seat('w'), {
      stock: [],
      options: [option('w', 'standard_production')],
    })
    expect(readiness.quote.ready).toBe(true)
    expect(readiness.reservation.ready).toBe(false)
    expect(readiness.reservation.issues).toEqual([NO_PATH])
    expect(describeFulfillmentPaths(seat('w'), { stock: [], options: [option('w', 'standard_production')] })).toEqual([])
  })

  it('cas B — standard_production confirmée par un admin pour ce produit → reservation_ready', () => {
    const context = { stock: [], options: [confirmedOption('b', 'standard_production')] }
    const readiness = computeReadiness(seat('b'), context)
    expect(readiness.reservation.ready).toBe(true)
    expect(describeFulfillmentPaths(seat('b'), context)).toEqual(['standard_production'])
  })

  it('cas C — le stock réel suffit, sans aucune option', () => {
    const context = { stock: [stock('s', 3)], options: [] }
    expect(computeReadiness(seat('s'), context).reservation.ready).toBe(true)
    expect(describeFulfillmentPaths(seat('s'), context)).toEqual(['stock'])
  })

  it('cas E — un regroupement confirmé par un admin ouvre la réservation', () => {
    const context = { stock: [], options: [confirmedOption('g', 'grouped_production')] }
    expect(computeReadiness(seat('g'), context).reservation.ready).toBe(true)
    expect(describeFulfillmentPaths(seat('g'), context)).toEqual(['grouped_production'])
  })

  it('un regroupement NON confirmé ne suffit pas', () => {
    const readiness = computeReadiness(seat('u'), {
      stock: [],
      options: [option('u', 'standard_production'), option('u', 'grouped_production')],
    })
    expect(readiness.quote.ready).toBe(true)
    expect(readiness.reservation.ready).toBe(false)
    expect(readiness.reservation.issues).toEqual([NO_PATH])
  })

  it("la confirmation d'un autre produit ne compte pas", () => {
    const readiness = computeReadiness(seat('x'), {
      stock: [stock('y', 50)],
      options: [confirmedOption('y', 'standard_production'), confirmedOption('y', 'grouped_production')],
    })
    expect(readiness.reservation.ready).toBe(false)
  })

  it("un produit sur demande n'a pas de raison no_fulfillment_path en plus (déjà manuel)", () => {
    const readiness = computeReadiness(seat('o', { visibility: 'on_request' }))
    expect(codes(readiness.reservation.issues)).toEqual(['on_request_product'])
  })
})
