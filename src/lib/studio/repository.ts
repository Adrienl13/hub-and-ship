// Lecture du catalogue qualifié pour le Studio (lot 1).
//
// Source unique : la vue `studio_products` (products_public + profil Studio),
// lue avec des colonnes EXPLICITES — jamais `select('*')` sur products, et la
// vue elle-même ne contient aucune colonne de coût (migration 39). Les
// variantes, les options de fulfillment déclarées, le stock réel et le signal
// « production ouverte » (un container ouvert) sont lus séparément.
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
  PRICE_BASES,
  SEAT_KINDS,
  SEAT_MATERIALS,
  STUDIO_ROLES,
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

export const VARIANT_SELECT =
  'id, product_id, name, image_url, gallery_urls, sort_order, created_at, min_order_units'
export const FULFILLMENT_OPTION_SELECT =
  'id, product_id, variant_id, mode, min_quantity, max_quantity, price_basis, is_active, confirmed_by, available_from, expires_at'
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
  | 'studio_fulfillment_options'
  | 'stock_lines'
  | 'containers'

export interface StudioDbClient {
  from(table: StudioDbTable): {
    select(columns: string): SelectBuilder<Record<string, unknown>>
  }
}

export interface StudioCatalog {
  readonly products: ReadonlyArray<StudioProduct>
  readonly context: FulfillmentContext
  readonly source: 'db' | 'unconfigured'
}

const EMPTY_CATALOG: StudioCatalog = {
  products: [],
  context: { stock: [], options: [], productionOpen: false },
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
  return typeof value === 'string' && (allowed as ReadonlyArray<string>).includes(value)
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
  const role: StudioRole = oneOf(row.studio_role, STUDIO_ROLES) ?? 'catalog_only'
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
  const mode = oneOf(row.mode, FULFILLMENT_MODES)
  if (mode !== 'standard_production' && mode !== 'grouped_production') return null
  return {
    id: asString(row.id),
    productId: asString(row.product_id),
    variantId: asNullableString(row.variant_id),
    mode,
    minQuantity: asNullableInt(row.min_quantity),
    maxQuantity: asNullableInt(row.max_quantity),
    priceBasis: oneOf(row.price_basis, PRICE_BASES) ?? 'container',
    isActive: row.is_active === true,
    confirmedBy: asNullableString(row.confirmed_by),
    availableFrom: asNullableString(row.available_from),
    expiresAt: asNullableString(row.expires_at),
  }
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
  const [productsResult, variantsResult, optionsResult, stockResult, containerResult] =
    await Promise.all([
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
        .from('studio_fulfillment_options')
        .select(FULFILLMENT_OPTION_SELECT)
        .eq('is_active', true),
      client
        .from('stock_lines')
        .select(STOCK_SELECT)
        .eq('is_active', true)
        .gt('available_units', 0),
      client.from('containers').select('id').eq('status', 'open').limit(1),
    ])

  if (productsResult.error) throw new Error(productsResult.error.message)
  if (variantsResult.error) throw new Error(variantsResult.error.message)
  if (optionsResult.error) throw new Error(optionsResult.error.message)
  if (stockResult.error) throw new Error(stockResult.error.message)
  if (containerResult.error) throw new Error(containerResult.error.message)

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
    context: {
      stock,
      options,
      productionOpen: (containerResult.data?.length ?? 0) > 0,
    },
    source: 'db',
  }
}

/** Point d'entrée navigateur : catalogue vide (jamais un mock) sans Supabase. */
export async function loadStudioCatalog(): Promise<StudioCatalog> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return EMPTY_CATALOG
  const client = createSupabaseBrowserClient(config)
  return fetchStudioCatalog(client as unknown as StudioDbClient)
}
