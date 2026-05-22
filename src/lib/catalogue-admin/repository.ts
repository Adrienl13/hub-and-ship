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
  AdminProduct,
  AdminProductDetail,
  AdminProductVariant,
  AdminSeedCommitment,
  ProductRow,
  ProductUpdate,
  ProductVariantRow,
  SeedCommitmentRow,
} from './types'
import { fromCommitmentRow, fromProductRow, fromVariantRow } from './types'
import type { Database } from '@/lib/supabase/types'

export type CatalogueAdminClient = SupabaseBrowserClient

export async function listProducts(
  client: CatalogueAdminClient,
): Promise<ReadonlyArray<AdminProduct>> {
  const { data, error } = await client
    .from('products')
    .select('*, product_variants(id)')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)

  type JoinedProductRow = ProductRow & {
    readonly product_variants?: ReadonlyArray<{ id: string }> | null
  }

  const rows = (data ?? []) as ReadonlyArray<JoinedProductRow>
  return rows.map((row) =>
    fromProductRow(row, row.product_variants?.length ?? 0),
  )
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
  const product = fromProductRow(data as ProductRow, variants.length)
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
