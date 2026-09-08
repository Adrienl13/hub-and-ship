// Studio Projet — types de la fondation (lot 1).
//
// Principe : la base Pros Import est la vérité commerciale. Les types
// ci-dessous DÉCRIVENT et QUALIFIENT le catalogue (rôle Studio, matière,
// qualité de chaque donnée, voies de fulfillment) ; aucun d'eux ne porte un
// prix, un MOQ, un stock ou une compatibilité inventés. Les lots 2 à 8
// ajouteront leurs propres types (moteur, projets persistés, devis).

import type { Product } from '@/lib/products'

// ---------------------------------------------------------------------------
// Rôle Studio et caractéristiques objectives
// ---------------------------------------------------------------------------

export const STUDIO_ROLES = ['seat', 'tabletop', 'base', 'catalog_only'] as const
export type StudioRole = (typeof STUDIO_ROLES)[number]

export const SEAT_KINDS = ['chair', 'armchair', 'stool', 'lounger', 'other'] as const
export type SeatKind = (typeof SEAT_KINDS)[number]

export const SEAT_MATERIALS = [
  'pe_weave',
  'cane',
  'rope',
  'textilene',
  'aluminium',
  'hpl',
  'metal',
  'other',
] as const
export type SeatMaterial = (typeof SEAT_MATERIALS)[number]

// ---------------------------------------------------------------------------
// Qualité de données granulaire
// ---------------------------------------------------------------------------

export const DATA_QUALITY_STATUSES = ['verified', 'estimated', 'pending'] as const
export type DataQualityStatus = (typeof DATA_QUALITY_STATUSES)[number]

/** Provenance d'une valeur. Les provenances HEURISTIQUES ne peuvent jamais
 *  aboutir à `verified` (voir data-quality.ts). */
export const DATA_QUALITY_SOURCES = [
  'admin_input',
  'supplier_sheet',
  'catalogue_public_price',
  'sku_prefix',
  'name_heuristic',
  'family_mode',
  'category',
  'pipeline',
  'none',
] as const
export type DataQualitySource = (typeof DATA_QUALITY_SOURCES)[number]

export const HEURISTIC_SOURCES: ReadonlySet<DataQualitySource> = new Set([
  'sku_prefix',
  'name_heuristic',
  'family_mode',
  'category',
  'pipeline',
])

export const DATA_QUALITY_FIELDS = [
  'dimensions',
  'weight',
  'material',
  'price',
  'compatibility',
  'customization',
  'media',
  'model_family',
] as const
export type DataQualityField = (typeof DATA_QUALITY_FIELDS)[number]

/** Projection PUBLIQUE d'une entrée de qualité (vue studio_products via
 *  studio_public_data_quality()). Les métadonnées internes (`by`, `note`)
 *  restent en base et n'existent pas côté client : le type ne les porte pas
 *  et parseDataQuality les ignore même si elles arrivaient. */
export interface DataQualityEntry {
  readonly status: DataQualityStatus
  readonly source: DataQualitySource
  readonly updatedAt?: string | null
}

export type DataQuality = Partial<Record<DataQualityField, DataQualityEntry>>

// ---------------------------------------------------------------------------
// Profil Studio d'un produit (table studio_product_profiles, vue studio_products)
// ---------------------------------------------------------------------------

export interface StudioProfile {
  readonly studioRole: StudioRole
  readonly seatKind: SeatKind | null
  readonly material: SeatMaterial | null
  /** Jamais déduit du nom : null tant qu'une famille n'est pas vérifiée. */
  readonly modelFamilyId: string | null
  /** Traits visuels calculés (lot 3), jamais saisis à la main. */
  readonly visualTraits: Readonly<Record<string, unknown>> | null
  readonly dataQuality: DataQuality
}

export interface StudioProduct extends Product {
  readonly decisionImageUrl?: string
  readonly decisionThumbUrl?: string
  readonly isActive: boolean
  readonly studio: StudioProfile
}

// ---------------------------------------------------------------------------
// Fulfillment
// ---------------------------------------------------------------------------

export const FULFILLMENT_MODES = [
  'stock',
  'standard_production',
  'grouped_production',
  'manual_review',
] as const
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number]

export const PRICE_BASES = ['container', 'stock'] as const
export type PriceBasis = (typeof PRICE_BASES)[number]

export const FULFILLMENT_OPTION_SOURCES = ['seed_moq', 'admin'] as const
export type FulfillmentOptionSource = (typeof FULFILLMENT_OPTION_SOURCES)[number]

/** Voie de production déclarée en base, lue par la vue publique
 *  studio_fulfillment_options_public. Le stock n'est PAS une option
 *  déclarée : il est lu en direct dans stock_lines pour ne jamais fabriquer
 *  une disponibilité périmée.
 *
 *  `isConfirmed` est le SEUL signal de confirmation : un admin a confirmé
 *  cette voie pour ce produit/variant. Une option non confirmée (dont toute
 *  option `seed_moq`) informe le devis et la faisabilité, jamais la
 *  réservation. L'identité de l'admin (confirmed_by) reste interne. */
export interface FulfillmentOption {
  readonly id: string
  readonly productId: string
  readonly variantId: string | null
  readonly mode: 'standard_production' | 'grouped_production'
  readonly minQuantity: number | null
  readonly maxQuantity: number | null
  readonly priceBasis: PriceBasis
  /** `seed_moq` = série standard connue par la fiche ; `admin` = déclarée. */
  readonly source: FulfillmentOptionSource
  readonly isActive: boolean
  readonly isConfirmed: boolean
  readonly availableFrom: string | null
  readonly expiresAt: string | null
}

/** Disponibilité réelle lue dans stock_lines (jamais estimée). */
export interface StockAvailability {
  readonly stockLineId: string
  readonly productId: string
  readonly variantId: string
  readonly availableUnits: number
  readonly stockPriceHt: number
}

/** Contexte de résolution. Il n'existe AUCUN signal global (« un container
 *  est ouvert ») : une voie n'est confirmée que par le stock réel ou par une
 *  option confirmée pour ce produit/variant. */
export interface FulfillmentContext {
  readonly stock: ReadonlyArray<StockAvailability>
  readonly options: ReadonlyArray<FulfillmentOption>
  readonly now?: Date
}

// ---------------------------------------------------------------------------
// Curation et paires diagnostiques (lot 2 : infrastructure seulement)
// ---------------------------------------------------------------------------

/** Jeu curé lu par la vue publique studio_curation_sets_public (jeux actifs
 *  seulement). Aucun jeu n'est inventé : sans ligne en base, pas de jeu. */
export interface CurationSet {
  readonly id: string
  readonly label: string
  readonly productIds: ReadonlyArray<string>
}

/** Paire diagnostique EXPLICITE (vérifiée), lue par la vue publique
 *  studio_diagnostic_pairs_public. Vide par défaut : aucun duel sans paire. */
export interface DiagnosticPair {
  readonly id: string
  readonly productAId: string
  readonly productBId: string
  readonly axis: string
}

// ---------------------------------------------------------------------------
// Raisons commerciales et états projet
// ---------------------------------------------------------------------------

export const COMMERCIAL_REASONS = [
  'below_moq',
  'colour_minimum',
  'stock_insufficient',
  'on_request_product',
  'price_unconfirmed',
  'price_indicative',
  'dimensions_unconfirmed',
  'compatibility_unconfirmed',
  'custom_colour_requested',
  'custom_tabletop_requested',
  /** Série standard connue mais production non confirmée par un admin pour
   *  ce produit : devis possible, réservation non. */
  'production_unconfirmed',
  'product_not_discoverable',
  'no_fulfillment_path',
  'empty_project',
] as const
export type CommercialReason = (typeof COMMERCIAL_REASONS)[number]

export const PROJECT_STATES = [
  'auto_quote_ready',
  'manual_quote_required',
  'reservation_ready',
  'feasibility_review',
] as const
export type ProjectState = (typeof PROJECT_STATES)[number]

/** Ligne de projet telle que le Studio la manipule (lot 1 : local seulement). */
export interface StudioProjectItem {
  readonly productId: string
  readonly variantId: string
  /** N'importe quel entier positif : le MOQ ne bloque jamais la saisie. */
  readonly requestedQuantity: number
  readonly role: StudioRole
  /** Coloris hors catalogue demandé (RAL/Pantone) : confirmation usine. */
  readonly customColour?: boolean
  /** Dimensions hors catalogue demandées : confirmation usine. */
  readonly customDimensions?: boolean
}
