// Préparation de la découverte Assises (lot 2) : fonctions PURES entre le
// catalogue Studio et le moteur.
//
// - seules les assises discovery_ready entrent en découverte (readiness lot 1) ;
// - en preview uniquement, `?set=<id>` restreint au jeu curé ACTIF correspondant, s'il existe ; sans
//   jeu valide, la découverte continue sur toutes les assises et l'interface
//   le dit (aucun jeu n'est inventé) ;
// - la spécification affichée sur une carte vient de la base : dimensions
//   si complètes, sinon poids, sinon rien.

import type { StudioAccessSource } from './access'
import { formatProductDimensions } from '@/lib/products'
import { toEngineSeat, type EngineCatalogue } from './engine'
import { computeReadiness } from './readiness'
import type { StudioCatalog } from './repository'
import type { CurationSet, StudioProduct } from './types'

export interface DiscoveryPool {
  readonly seats: ReadonlyArray<StudioProduct>
  readonly seatsById: ReadonlyMap<string, StudioProduct>
  readonly engineCatalogue: EngineCatalogue
  /** Jeu curé appliqué, ou null. */
  readonly curationSet: CurationSet | null
  /** Un jeu a été demandé mais n'existe pas (ou est vide) : découverte complète. */
  readonly curationMissing: boolean
}

export function isDiscoverySeat(product: StudioProduct): boolean {
  return product.studio.studioRole === 'seat' && computeReadiness(product).discovery.ready
}

export function buildDiscoveryPool(
  catalog: Pick<StudioCatalog, 'products' | 'curationSets' | 'diagnosticPairs'>,
  options: { readonly set?: string | null; readonly accessSource?: StudioAccessSource } = {},
): DiscoveryPool {
  const allSeats = catalog.products.filter(isDiscoverySeat)
  const requested = options.accessSource === 'preview' && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(options.set ?? '')
    ? options.set!
    : ''
  const curationSet = requested
    ? (catalog.curationSets.find((set) => set.id === requested) ?? null)
    : null
  const allowed = curationSet ? new Set(curationSet.productIds) : null
  const curated = allowed ? allSeats.filter((seat) => allowed.has(seat.id)) : allSeats
  const curationMissing = requested.length > 0 && (curationSet === null || curated.length === 0)
  const seats = curationMissing ? allSeats : curated
  // Migration 39 : studio_products hérite du CASE WHEN f.status = 'verified'
  // de studio_product_profiles_public. Un ID public non vide est donc une
  // preuve SQL ; aucun ID n'est déduit du nom ou des attributs du produit.
  const verifiedFamilies = new Set(seats.flatMap((seat) => {
    const id = seat.studio.modelFamilyId
    return typeof id === 'string' && id.trim().length > 0 ? [id] : []
  }))
  return {
    seats,
    seatsById: new Map(seats.map((seat) => [seat.id, seat] as const)),
    engineCatalogue: {
      seats: seats.map((seat) => toEngineSeat(seat, verifiedFamilies)),
      diagnosticPairs: catalog.diagnosticPairs,
    },
    curationSet: curationMissing ? null : curationSet,
    curationMissing,
  }
}

/** UNE spécification pertinente, issue de la base ; null si rien de fiable. */
export function seatSpecLine(product: StudioProduct): string | null {
  const { l, w, h } = product.dimensions
  if (l > 0 && w > 0 && h > 0) return formatProductDimensions(product)
  if (product.weightKg > 0) return `${product.weightKg} kg`
  return null
}

/** Image à afficher sur la carte : photo du design par défaut, sinon la
 *  photo principale. Aucune transformation (Decision Images = lot 3). */
export function cardImageUrl(product: StudioProduct, variantId?: string | null): string {
  const variant = variantId
    ? product.variants.find((entry) => entry.id === variantId)
    : product.variants[0]
  return variant?.imageUrl ?? product.mainImageUrl
}
