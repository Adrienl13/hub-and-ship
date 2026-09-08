// Lecture du catalogue qualifié pour le Studio (lot 1).
//
// Sources : UNIQUEMENT des surfaces publiques (migration 39), lues avec des
// colonnes EXPLICITES — jamais `select('*')` :
// - `studio_products` (products_public + profil public) : aucune colonne de
//   coût, data_quality projetée (status/source/updatedAt) ;
// - `studio_fulfillment_options_public` : booléen `is_confirmed`, jamais
//   `confirmed_by` ni `note` ;
// - `product_variants`, `stock_lines` (stock réel, jamais copié).
// Les tables internes studio_* (notes, updated_by, confirmed_by…) ne sont
// jamais lues ici : le navigateur n'a aucun droit dessus. Il n'existe aucun
// signal global de production (containers) : une voie n'est confirmée que
// par le stock réel ou une option confirmée pour le produit.
//
// Pattern : client injecté (structurel), mapping row → type, fallback vide
// propre si Supabase n'est pas configuré. Aucune écriture.

import { productFromRow, variantFromRow } from '@/lib/catalogue/db'
import { PUBLIC_PRODUCT_COLUMNS } from '@/lib/catalogue/product-columns'
import type { DesignVariant } from '@/lib/products'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { parseDataQuality } from './data-quality'
import {
  FULFILLMENT_MODES,
  FULFILLMENT_OPTION_SOURCES,
  PRICE_BASES,
  SEAT_KINDS,
  SEAT_MATERIALS,
  STUDIO_ROLES,
  type CurationSet,
  type DiagnosticPair,
  type FulfillmentContext,
  type FulfillmentOption,
  type SeatKind,
  type SeatMaterial,
  type StockAvailability,
  type StudioProduct,
  type StudioRole,
} from './types'

export const STUDIO_PROFILE_COLUMNS = [
  'studio_role',
  'seat_kind',
  'material',
  'model_family_id',
  'visual_traits',
  'data_quality',
] as const

/** Projection explicite de la vue studio_products. */
export const STUDIO_PRODUCT_SELECT: string = [
  ...PUBLIC_PRODUCT_COLUMNS,
  ...STUDIO_PROFILE_COLUMNS,
].join(', ')

/** Colonnes internes des tables studio_* : jamais dans une surface publique,
 *  jamais sélectionnées par le navigateur (parité vérifiée en test). */
export const STUDIO_INTERNAL_COLUMNS = [
  'notes',
  'note',
  'created_by',
  'updated_by',
  'confirmed_by',
  'validated_by',
  'validated_at',
  'rejected_reason',
  'embedding',
  'source_media_id',
  'evidence',
  'metadata',
  'reviewed_by',
] as const

/** Colonnes de la vue publique studio_fulfillment_options_public. */
export const FULFILLMENT_OPTION_COLUMNS = [
  'id',
  'product_id',
  'variant_id',
  'mode',
  'min_quantity',
  'max_quantity',
  'price_basis',
  'source',
  'is_active',
  'is_confirmed',
  'available_from',
  'expires_at',
] as const

/** Colonnes des autres surfaces publiques Studio (référence pour les
 *  contrôles ; le lot 1 ne lit pas les familles). */
export const STUDIO_PROFILE_PUBLIC_COLUMNS = [
  'product_id',
  ...STUDIO_PROFILE_COLUMNS,
] as const
export const MODEL_FAMILY_PUBLIC_COLUMNS = ['id', 'label', 'status'] as const

/** Colonnes des surfaces publiques du lot 2 (jeux curés actifs, paires
 *  diagnostiques vérifiées). Jamais notes, created_by, verified_by. */
export const CURATION_SET_PUBLIC_COLUMNS = [
  'id',
  'label',
  'product_ids',
] as const
export const DIAGNOSTIC_PAIR_PUBLIC_COLUMNS = [
  'id',
  'product_a_id',
  'product_b_id',
  'axis',
] as const

export const VARIANT_SELECT =
  'id, product_id, name, image_url, gallery_urls, sort_order, created_at, min_order_units'
export const CURATION_SET_SELECT: string =
  CURATION_SET_PUBLIC_COLUMNS.join(', ')
export const DIAGNOSTIC_PAIR_SELECT: string =
  DIAGNOSTIC_PAIR_PUBLIC_COLUMNS.join(', ')
export const FULFILLMENT_OPTION_SELECT: string =
  FULFILLMENT_OPTION_COLUMNS.join(', ')
export const STOCK_SELECT =
  'id, product_id, variant_id, available_units, stock_price_ht'

interface QueryResult<T> {
  readonly data: ReadonlyArray<T> | null
  readonly error: { readonly message: string } | null
}

interface SelectBuilder<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: string | number | boolean): SelectBuilder<T>
  gt(column: string, value: number): SelectBuilder<T>
  order(column: string, options: { ascending: boolean }): SelectBuilder<T>
  limit(count: number): SelectBuilder<T>
}

export type StudioDbTable =
  | 'studio_products'
  | 'product_variants'
  | 'studio_fulfillment_options_public'
  | 'stock_lines'
  | 'studio_curation_sets_public'
  | 'studio_diagnostic_pairs_public'

export interface StudioDbClient {
  from(table: StudioDbTable): {
    select(columns: string): SelectBuilder<Record<string, unknown>>
  }
}

export interface StudioCatalog {
  readonly visual?: import('./visual').StudioVisualData
  readonly products: ReadonlyArray<StudioProduct>
  readonly context: FulfillmentContext
  /** Jeux curés ACTIFS déclarés en base (lot 2 : infrastructure). */
  readonly curationSets: ReadonlyArray<CurationSet>
  /** Paires diagnostiques VÉRIFIÉES (lot 2 : vides par défaut). */
  readonly diagnosticPairs: ReadonlyArray<DiagnosticPair>
  readonly source: 'db' | 'unconfigured'
}

const EMPTY_CATALOG: StudioCatalog = {
  products: [],
  context: { stock: [], options: [] },
  curationSets: [],
  diagnosticPairs: [],
  source: 'unconfigured',
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Math.trunc(asNumber(value, Number.NaN))
  return Number.isFinite(parsed) ? parsed : null
}

function oneOf<T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
): T | null {
  return typeof value === 'string' &&
    (allowed as ReadonlyArray<string>).includes(value)
    ? (value as T)
    : null
}

function studioProductFromRow(
  row: Record<string, unknown>,
  variants: ReadonlyArray<DesignVariant>,
): StudioProduct {
  // La vue porte exactement les colonnes publiques de products : le mapping
  // catalogue existant s'applique tel quel (aucun prix canal ici : le Studio
  // lit le prix public direct, comme un visiteur).
  const product = productFromRow(
    row as Parameters<typeof productFromRow>[0],
    variants,
  )
  const role: StudioRole =
    oneOf(row.studio_role, STUDIO_ROLES) ?? 'catalog_only'
  const seatKind: SeatKind | null = oneOf(row.seat_kind, SEAT_KINDS)
  const material: SeatMaterial | null = oneOf(row.material, SEAT_MATERIALS)
  const traits =
    row.visual_traits && typeof row.visual_traits === 'object'
      ? (row.visual_traits as Record<string, unknown>)
      : null
  return {
    ...product,
    isActive: row.is_active === true,
    studio: {
      studioRole: role,
      seatKind,
      material,
      modelFamilyId: asNullableString(row.model_family_id),
      visualTraits: traits,
      dataQuality: parseDataQuality(row.data_quality),
    },
  }
}

function optionFromRow(row: Record<string, unknown>): FulfillmentOption | null {
  // La table n'accepte que standard_production / grouped_production
  // (contrainte SQL) ; le filtre reste ici par défense en profondeur.
  const mode = oneOf(row.mode, FULFILLMENT_MODES)
  if (mode !== 'standard_production' && mode !== 'grouped_production')
    return null
  return {
    id: asString(row.id),
    productId: asString(row.product_id),
    variantId: asNullableString(row.variant_id),
    mode,
    minQuantity: asNullableInt(row.min_quantity),
    maxQuantity: asNullableInt(row.max_quantity),
    priceBasis: oneOf(row.price_basis, PRICE_BASES) ?? 'container',
    source: oneOf(row.source, FULFILLMENT_OPTION_SOURCES) ?? 'admin',
    isActive: row.is_active === true,
    // Seul un booléen strict confirme : toute autre valeur = non confirmée.
    isConfirmed: row.is_confirmed === true,
    availableFrom: asNullableString(row.available_from),
    expiresAt: asNullableString(row.expires_at),
  }
}

function curationSetFromRow(row: Record<string, unknown>): CurationSet | null {
  const id = asNullableString(row.id)
  if (!id) return null
  const productIds = Array.isArray(row.product_ids)
    ? row.product_ids.filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      )
    : []
  return { id, label: asString(row.label, id), productIds }
}

function diagnosticPairFromRow(
  row: Record<string, unknown>,
): DiagnosticPair | null {
  const id = asNullableString(row.id)
  const productAId = asNullableString(row.product_a_id)
  const productBId = asNullableString(row.product_b_id)
  const axis = asNullableString(row.axis)
  if (!id || !productAId || !productBId || !axis || productAId === productBId)
    return null
  return { id, productAId, productBId, axis }
}

function stockFromRow(row: Record<string, unknown>): StockAvailability {
  return {
    stockLineId: asString(row.id),
    productId: asString(row.product_id),
    variantId: asString(row.variant_id),
    availableUnits: Math.max(0, Math.trunc(asNumber(row.available_units))),
    stockPriceHt: asNumber(row.stock_price_ht),
  }
}

export async function fetchStudioCatalog(
  client: StudioDbClient,
): Promise<StudioCatalog> {
  const [
    productsResult,
    variantsResult,
    optionsResult,
    stockResult,
    setsResult,
    pairsResult,
  ] = await Promise.all([
    client
      .from('studio_products')
      .select(STUDIO_PRODUCT_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    client
      .from('product_variants')
      .select(VARIANT_SELECT)
      .order('sort_order', { ascending: true }),
    client
      .from('studio_fulfillment_options_public')
      .select(FULFILLMENT_OPTION_SELECT)
      .eq('is_active', true),
    client
      .from('stock_lines')
      .select(STOCK_SELECT)
      .eq('is_active', true)
      .gt('available_units', 0),
    client.from('studio_curation_sets_public').select(CURATION_SET_SELECT),
    client
      .from('studio_diagnostic_pairs_public')
      .select(DIAGNOSTIC_PAIR_SELECT),
  ])

  if (productsResult.error) throw new Error(productsResult.error.message)
  if (variantsResult.error) throw new Error(variantsResult.error.message)
  if (optionsResult.error) throw new Error(optionsResult.error.message)
  if (stockResult.error) throw new Error(stockResult.error.message)
  // Surfaces du lot 2 : leur absence (migration pas encore appliquée) ne
  // doit pas priver la découverte ; on dégrade en listes vides.
  const curationSets = setsResult.error
    ? []
    : (setsResult.data ?? [])
        .map(curationSetFromRow)
        .filter((set): set is CurationSet => set !== null)
  const diagnosticPairs = pairsResult.error
    ? []
    : (pairsResult.data ?? [])
        .map(diagnosticPairFromRow)
        .filter((pair): pair is DiagnosticPair => pair !== null)

  const variantsByProduct = new Map<string, DesignVariant[]>()
  for (const row of variantsResult.data ?? []) {
    const productId = asString(row.product_id)
    const list = variantsByProduct.get(productId) ?? []
    // unitsCommitted = 0 : le Studio ne lit pas les engagements container.
    list.push(variantFromRow(row as Parameters<typeof variantFromRow>[0], 0))
    variantsByProduct.set(productId, list)
  }

  const products = (productsResult.data ?? [])
    .map((row) =>
      studioProductFromRow(row, variantsByProduct.get(asString(row.id)) ?? []),
    )
    .filter((product) => product.variants.length > 0)

  const options = (optionsResult.data ?? [])
    .map(optionFromRow)
    .filter((option): option is FulfillmentOption => option !== null)
  const stock = (stockResult.data ?? []).map(stockFromRow)

  return {
    products,
    context: { stock, options },
    curationSets,
    diagnosticPairs,
    source: 'db',
  }
}

/** Point d'entrée navigateur : catalogue vide (jamais un mock) sans Supabase. */
export async function loadStudioCatalog(): Promise<StudioCatalog> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return EMPTY_CATALOG
  const client = createSupabaseBrowserClient(config)
  const catalog = await fetchStudioCatalog(client as unknown as StudioDbClient)
  const { enrichVisualCatalog } = await import('./visual-repository')
  return enrichVisualCatalog(catalog)
}
