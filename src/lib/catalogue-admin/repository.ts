// Admin-grade catalogue repository. Mirrors the pattern used by
// `quality-reports/repository.ts` and `delivered-containers/repository.ts`:
// a single browser-friendly module that maps DB rows to public types and
// keeps row<->payload conversions in one place.
//
// All writes target tables protected by RLS policies that require
// `current_user_role()` to be in ('admin','super_admin'). Read endpoints
// surface inactive products too (the public catalogue is gated separately).

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  AdminContainerOption,
  AdminPricingParameters,
  AdminProduct,
  AdminProductDetail,
  AdminProductVariant,
  AdminSeedCommitment,
  PricingParameterRow,
  PricingParameterUpdate,
  ProductPartnerPriceRow,
  ProductPricingInputRow,
  ProductRow,
  ProductUpdate,
  ProductVariantRow,
  SeedCommitmentRow,
} from './types'
import {
  fromCommitmentRow,
  fromPricingParameterRow,
  fromProductRow,
  fromVariantRow,
} from './types'
import type { Database } from '@/lib/supabase/types'

export type CatalogueAdminClient = SupabaseBrowserClient

export async function listProducts(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<AdminProduct>> {
  const productsResult = await client
    .from('products')
    .select('*, product_variants(id)')
    .order('sort_order', { ascending: true })

  if (productsResult.error) throw new Error(productsResult.error.message)

  type JoinedProductRow = ProductRow & {
    readonly product_variants?: ReadonlyArray<{ id: string }> | null
  }

  const partnerPriceByProduct = new Map<string, ProductPartnerPriceRow>()
  for (const row of await listPartnerPricesIfAvailable(client)) {
    partnerPriceByProduct.set(row.product_id, row)
  }
  const pricingInputByProduct = new Map<string, ProductPricingInputRow>()
  for (const row of await listPricingInputsIfAvailable(client)) {
    pricingInputByProduct.set(row.product_id, row)
  }

  const rows = (productsResult.data ?? []) as ReadonlyArray<JoinedProductRow>
  return rows.map((row) =>
    fromProductRow(
      row,
      row.product_variants?.length ?? 0,
      activePartnerNetPrice(partnerPriceByProduct.get(row.id)),
      pricingInputByProduct.get(row.id) ?? null,
    ),
  )
}

export async function getActivePricingParameters(
  client: CatalogueAdminClient,
): Promise<AdminPricingParameters | null> {
  const { data, error } = await client
    .from('pricing_parameters')
    .select('*')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? fromPricingParameterRow(data) : null
}

export async function updatePricingParameters(
  client: CatalogueAdminClient,
  id: string,
  payload: PricingParameterUpdate,
): Promise<void> {
  const { error } = await client
    .from('pricing_parameters')
    .update(payload as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// P0 pilotage — RPCs de la migration 20260709090000. Chaque sauvegarde crée
// une NOUVELLE version (l'historique est immuable) ; le recalcul des prix est
// toujours explicite : dry-run (preview) puis application en un clic.
// ---------------------------------------------------------------------------

// Les RPCs ci-dessous passent par des casts explicites : le client typé
// supabase-js ne résout pas les fonctions de notre Database maintenue à la
// main (même motif que le `as never` de AdminProductEditor).
type RpcResult<T> = {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

export async function savePricingParametersVersion(
  client: CatalogueAdminClient,
  payload: PricingParameterUpdate & { readonly label?: string },
): Promise<void> {
  const { error } = (await client.rpc('admin_save_pricing_parameters', {
    payload,
  } as never)) as RpcResult<unknown>
  if (error) throw new Error(error.message)
}

export async function listPricingParameterVersions(
  client: CatalogueAdminClient,
  limit = 12,
): Promise<ReadonlyArray<AdminPricingParameters>> {
  const { data, error } = await client
    .from('pricing_parameters')
    .select('*')
    .order('version', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<PricingParameterRow>).map(
    fromPricingParameterRow,
  )
}

export interface PricingControlStatus {
  readonly controlSku: string
  readonly computable: boolean
  readonly expectedDirectHt: number | null
  readonly actualDirectHt: number | null
  readonly driftPercent: number | null
}

export async function checkPricingControl(
  client: CatalogueAdminClient,
): Promise<PricingControlStatus | null> {
  const { data, error } = (await client.rpc(
    'check_pricing_control',
  )) as RpcResult<
    ReadonlyArray<{
      control_sku: string
      computable: boolean
      expected_direct_ht: number | string | null
      actual_direct_ht: number | string | null
      drift_percent: number | string | null
    }>
  >
  if (error) throw new Error(error.message)
  const row = (data ?? [])[0]
  if (!row) return null
  return {
    controlSku: row.control_sku,
    computable: row.computable,
    expectedDirectHt:
      row.expected_direct_ht === null ? null : Number(row.expected_direct_ht),
    actualDirectHt:
      row.actual_direct_ht === null ? null : Number(row.actual_direct_ht),
    driftPercent:
      row.drift_percent === null ? null : Number(row.drift_percent),
  }
}

export interface RepriceRow {
  readonly productId: string
  readonly sku: string
  readonly name: string
  readonly hasCosts: boolean
  readonly currentPriceHt: number
  readonly enginePriceHt: number | null
  readonly deltaPercent: number | null
  readonly atMarginFloor: boolean
}

export async function previewReprice(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<RepriceRow>> {
  const { data, error } = (await client.rpc(
    'admin_preview_reprice',
  )) as RpcResult<
    ReadonlyArray<{
      product_id: string
      sku: string
      name: string
      has_costs: boolean
      current_price_ht: number | string
      engine_price_ht: number | string | null
      delta_percent: number | string | null
      at_margin_floor: boolean
    }>
  >
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    hasCosts: row.has_costs,
    currentPriceHt: Number(row.current_price_ht),
    enginePriceHt:
      row.engine_price_ht === null ? null : Number(row.engine_price_ht),
    deltaPercent:
      row.delta_percent === null ? null : Number(row.delta_percent),
    atMarginFloor: row.at_margin_floor,
  }))
}

export async function applyReprice(
  client: CatalogueAdminClient,
): Promise<number> {
  const { data, error } = (await client.rpc(
    'admin_apply_reprice',
  )) as RpcResult<{ updated?: number }>
  if (error) throw new Error(error.message)
  const updated = data?.updated
  return typeof updated === 'number' ? updated : 0
}

// Ajustement ciblé (migration 20260709120000) : ±X % sur une catégorie et/ou
// un préfixe de SKU (collection), en deux temps preview → apply.
export interface PriceAdjustmentScope {
  readonly category?: string
  readonly skuPrefix?: string
  readonly percent: number
}

export interface PriceAdjustmentRow {
  readonly productId: string
  readonly sku: string
  readonly name: string
  readonly category: string
  readonly currentPriceHt: number
  readonly newPriceHt: number
  readonly belowFloor: boolean
}

function adjustmentPayload(scope: PriceAdjustmentScope) {
  return {
    category: scope.category ?? null,
    sku_prefix: scope.skuPrefix ?? null,
    percent: scope.percent,
  }
}

export async function previewPriceAdjustment(
  client: CatalogueAdminClient,
  scope: PriceAdjustmentScope,
): Promise<ReadonlyArray<PriceAdjustmentRow>> {
  const { data, error } = (await client.rpc('admin_preview_price_adjustment', {
    payload: adjustmentPayload(scope),
  } as never)) as RpcResult<
    ReadonlyArray<{
      product_id: string
      sku: string
      name: string
      category: string
      current_price_ht: number | string
      new_price_ht: number | string
      below_floor: boolean
    }>
  >
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    currentPriceHt: Number(row.current_price_ht),
    newPriceHt: Number(row.new_price_ht),
    belowFloor: row.below_floor,
  }))
}

export async function applyPriceAdjustment(
  client: CatalogueAdminClient,
  scope: PriceAdjustmentScope,
): Promise<number> {
  const { data, error } = (await client.rpc('admin_apply_price_adjustment', {
    payload: adjustmentPayload(scope),
  } as never)) as RpcResult<{ updated?: number }>
  if (error) throw new Error(error.message)
  const updated = data?.updated
  return typeof updated === 'number' ? updated : 0
}

// ---------------------------------------------------------------------------
// Prix nets PAR CANAL partenaire — channel_price_overrides est la table que
// le circuit live lit réellement (get_catalogue_prices + RPC réservation).
// RLS « Admins manage channel price overrides » : accès table direct.
// ---------------------------------------------------------------------------

export type PartnerChannel = 'revendeur' | 'distributeur' | 'grand_compte'

export const PARTNER_CHANNELS: ReadonlyArray<PartnerChannel> = [
  'revendeur',
  'distributeur',
  'grand_compte',
]

export interface ChannelPriceOverride {
  readonly channel: PartnerChannel
  readonly unitPriceHt: number
}

export async function listChannelPriceOverrides(
  client: CatalogueAdminClient,
  productId: string,
): Promise<ReadonlyArray<ChannelPriceOverride>> {
  const { data, error } = await client
    .from('channel_price_overrides')
    .select('channel, unit_price_ht')
    .eq('product_id', productId)

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<{
    channel: string
    unit_price_ht: number | string
  }>)
    .filter((row): row is { channel: PartnerChannel; unit_price_ht: number } =>
      (PARTNER_CHANNELS as ReadonlyArray<string>).includes(row.channel),
    )
    .map((row) => ({
      channel: row.channel,
      unitPriceHt: Number(row.unit_price_ht),
    }))
}

export interface ProductChannelPriceOverride extends ChannelPriceOverride {
  readonly productId: string
}

/** Tous les overrides du catalogue d'un coup (grille d'édition en masse). */
export async function listAllChannelPriceOverrides(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<ProductChannelPriceOverride>> {
  const { data, error } = await client
    .from('channel_price_overrides')
    .select('product_id, channel, unit_price_ht')

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<{
    product_id: string
    channel: string
    unit_price_ht: number | string
  }>)
    .filter(
      (
        row,
      ): row is {
        product_id: string
        channel: PartnerChannel
        unit_price_ht: number
      } => (PARTNER_CHANNELS as ReadonlyArray<string>).includes(row.channel),
    )
    .map((row) => ({
      productId: row.product_id,
      channel: row.channel,
      unitPriceHt: Number(row.unit_price_ht),
    }))
}

/**
 * Miroir du chemin legacy d'admin_save_product_full : le prix net revendeur
 * reste visible du moteur get_price (et de son trigger plancher) via
 * product_partner_prices. Prix null/0 → désactivation.
 */
export async function savePartnerNetPrice(
  client: CatalogueAdminClient,
  productId: string,
  netPriceHt: number | null,
  userId: string | null,
): Promise<void> {
  if (netPriceHt !== null && netPriceHt > 0) {
    const { error } = await client.from('product_partner_prices').upsert(
      {
        product_id: productId,
        net_price_ht: netPriceHt,
        is_active: true,
        override_reason: 'Grille prix partenaires (édition en masse)',
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'product_id' },
    )
    if (error) throw new Error(error.message)
  } else {
    const { error } = await client
      .from('product_partner_prices')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
  }
}

/**
 * Écrit l'état cible des overrides d'un produit : prix > 0 → upsert,
 * null/vide → suppression (le canal retombe sur base × coefficient).
 */
export async function saveChannelPriceOverrides(
  client: CatalogueAdminClient,
  productId: string,
  next: ReadonlyArray<{
    readonly channel: PartnerChannel
    readonly unitPriceHt: number | null
  }>,
): Promise<void> {
  for (const entry of next) {
    if (entry.unitPriceHt !== null && entry.unitPriceHt > 0) {
      const { error } = await client
        .from('channel_price_overrides')
        .upsert(
          {
            product_id: productId,
            channel: entry.channel,
            unit_price_ht: entry.unitPriceHt,
          } as never,
          { onConflict: 'product_id,channel' },
        )
      if (error) throw new Error(`${entry.channel} : ${error.message}`)
    } else {
      const { error } = await client
        .from('channel_price_overrides')
        .delete()
        .eq('product_id', productId)
        .eq('channel', entry.channel)
      if (error) throw new Error(`${entry.channel} : ${error.message}`)
    }
  }
}

function activePartnerNetPrice(row: ProductPartnerPriceRow | null | undefined) {
  return row?.is_active ? Number(row.net_price_ht) : null
}

function isMissingOptionalPartnerPriceTable(errorMessage: string): boolean {
  return (
    errorMessage.includes(
      "Could not find the table 'public.product_partner_prices'",
    ) ||
    (errorMessage.includes('product_partner_prices') &&
      errorMessage.includes('schema cache'))
  )
}

async function listPartnerPricesIfAvailable(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<ProductPartnerPriceRow>> {
  const { data, error } = await client.from('product_partner_prices').select('*')

  if (!error) return (data ?? []) as ReadonlyArray<ProductPartnerPriceRow>
  if (isMissingOptionalPartnerPriceTable(error.message)) return []

  throw new Error(error.message)
}

async function getPartnerPriceIfAvailable(
  client: CatalogueAdminClient,
  productId: string,
): Promise<ProductPartnerPriceRow | null> {
  const { data, error } = await client
    .from('product_partner_prices')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle()

  if (!error) return data as ProductPartnerPriceRow | null
  if (isMissingOptionalPartnerPriceTable(error.message)) return null

  throw new Error(error.message)
}

function isMissingOptionalPricingInputsTable(errorMessage: string): boolean {
  return (
    errorMessage.includes(
      "Could not find the table 'public.product_pricing_inputs'",
    ) ||
    (errorMessage.includes('product_pricing_inputs') &&
      errorMessage.includes('schema cache'))
  )
}

async function listPricingInputsIfAvailable(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<ProductPricingInputRow>> {
  const { data, error } = await client.from('product_pricing_inputs').select('*')

  if (!error) return (data ?? []) as ReadonlyArray<ProductPricingInputRow>
  if (isMissingOptionalPricingInputsTable(error.message)) return []

  throw new Error(error.message)
}

async function getPricingInputIfAvailable(
  client: CatalogueAdminClient,
  productId: string,
): Promise<ProductPricingInputRow | null> {
  const { data, error } = await client
    .from('product_pricing_inputs')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle()

  if (!error) return data as ProductPricingInputRow | null
  if (isMissingOptionalPricingInputsTable(error.message)) return null

  throw new Error(error.message)
}

export async function getProductWithVariants(
  client: CatalogueAdminClient,
  id: string,
): Promise<AdminProductDetail | null> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const variants = await listVariantsForProduct(client, id)
  const partnerPrice = await getPartnerPriceIfAvailable(client, id)
  const pricingInput = await getPricingInputIfAvailable(client, id)

  const product = fromProductRow(
    data as ProductRow,
    variants.length,
    activePartnerNetPrice(partnerPrice),
    pricingInput,
  )
  return {
    ...product,
    variants,
  }
}

export async function listVariantsForProduct(
  client: CatalogueAdminClient,
  productId: string,
): Promise<ReadonlyArray<AdminProductVariant>> {
  const { data, error } = await client
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<ProductVariantRow>).map(fromVariantRow)
}

export async function upsertProduct(
  client: CatalogueAdminClient,
  payload: Database['public']['Tables']['products']['Insert'],
): Promise<void> {
  const { error } = await client
    .from('products')
    .upsert(payload as never, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function updateProduct(
  client: CatalogueAdminClient,
  id: string,
  payload: ProductUpdate,
): Promise<void> {
  const { error } = await client
    .from('products')
    .update(payload as never)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function softDeleteProduct(
  client: CatalogueAdminClient,
  id: string,
): Promise<void> {
  await updateProduct(client, id, { is_active: false })
}

export async function reactivateProduct(
  client: CatalogueAdminClient,
  id: string,
): Promise<void> {
  await updateProduct(client, id, { is_active: true })
}

export async function upsertVariant(
  client: CatalogueAdminClient,
  payload: Database['public']['Tables']['product_variants']['Insert'],
): Promise<void> {
  const { error } = await client
    .from('product_variants')
    .upsert(payload as never, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function deleteVariant(
  client: CatalogueAdminClient,
  id: string,
): Promise<void> {
  const { error } = await client.from('product_variants').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listAdminContainers(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<AdminContainerOption>> {
  const { data, error } = await client
    .from('containers')
    .select('id, reference')
    .order('reference', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<{ id: string; reference: string }>).map(
    (row) => ({ id: row.id, reference: row.reference }),
  )
}

export async function listCommitmentsForProduct(
  client: CatalogueAdminClient,
  productId: string,
): Promise<ReadonlyArray<AdminSeedCommitment>> {
  // Pull commitments for all variants of this product. We join via the
  // variants list returned client-side to keep the query simple.
  const variants = await listVariantsForProduct(client, productId)
  if (variants.length === 0) return []
  const variantIds = variants.map((variant) => variant.id)

  const { data, error } = await client
    .from('container_seed_commitments')
    .select('*')
    .in('variant_id', variantIds)

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<SeedCommitmentRow>).map(
    fromCommitmentRow,
  )
}

export async function upsertCommitment(
  client: CatalogueAdminClient,
  payload: {
    readonly container_id: string
    readonly variant_id: string
    readonly units_committed: number
  },
): Promise<void> {
  if (payload.units_committed <= 0) {
    // Delete on zero to keep the table clean.
    const { error } = await client
      .from('container_seed_commitments')
      .delete()
      .eq('container_id', payload.container_id)
      .eq('variant_id', payload.variant_id)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await client
    .from('container_seed_commitments')
    .upsert(payload as never, { onConflict: 'container_id,variant_id' })
  if (error) throw new Error(error.message)
}
