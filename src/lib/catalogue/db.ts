// Read the catalogue from Supabase and shape it into the same `Product[]` +
// container info that the rest of the UI already consumes. The browser
// client is enough: `products`, `product_variants`, `containers` and
// `container_seed_commitments` are all behind public SELECT policies.

import type { Database } from '@/lib/supabase/types'
import type {
  DesignVariant,
  Product,
  ProductCategory,
} from '@/lib/products'

type ProductRow = Database['public']['Tables']['products']['Row']
type VariantRow = Database['public']['Tables']['product_variants']['Row']
type ContainerRow = Database['public']['Tables']['containers']['Row']
type CommitmentRow =
  Database['public']['Tables']['container_seed_commitments']['Row']

export interface DbCurrentContainer {
  readonly id: string
  readonly reference: string
  readonly port: string
  readonly capacityCbm: number
  readonly thresholdPercent: number
  readonly minSeriesRequired: number
  readonly expectedCloseAt: string | null
  readonly status: 'open'
  readonly seriesReached: number
  readonly totalSeries: number
  readonly professionalsEngaged: number
  readonly containerType: '20_dv' | '20_hc' | '40_gp' | '40_hc'
}

export interface DbCatalog {
  readonly products: ReadonlyArray<Product>
  readonly currentContainer: DbCurrentContainer | null
}

interface CatalogueDbClient {
  from: {
    (table: 'products'): {
      select: (columns: '*') => {
        eq: (
          column: 'is_active',
          value: boolean,
        ) => {
          order: (
            column: 'sort_order',
            options: { ascending: boolean },
          ) => PromiseLike<{
            data: ReadonlyArray<ProductRow> | null
            error: { message: string } | null
          }>
        }
      }
    }
    (table: 'product_variants'): {
      select: (columns: '*') => {
        order: (
          column: 'sort_order',
          options: { ascending: boolean },
        ) => PromiseLike<{
          data: ReadonlyArray<VariantRow> | null
          error: { message: string } | null
        }>
      }
    }
    (table: 'containers'): {
      select: (columns: '*') => {
        eq: (
          column: 'status',
          value: 'open',
        ) => {
          order: (
            column: 'created_at',
            options: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => PromiseLike<{
              data: ReadonlyArray<ContainerRow> | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
    (table: 'container_seed_commitments'): {
      select: (columns: '*') => {
        eq: (
          column: 'container_id',
          value: string,
        ) => PromiseLike<{
          data: ReadonlyArray<CommitmentRow> | null
          error: { message: string } | null
        }>
      }
    }
  }
}

function variantFromRow(
  row: VariantRow,
  unitsCommitted: number,
): DesignVariant {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url ?? undefined,
    galleryUrls: [...(row.gallery_urls ?? [])],
    unitsCommitted,
  }
}

function productFromRow(
  row: ProductRow,
  variants: ReadonlyArray<DesignVariant>,
): Product {
  return {
    id: row.id,
    sku: row.sku,
    category: row.category as ProductCategory,
    name: row.name,
    description: row.description,
    dimensions: {
      l: row.dim_length_cm,
      w: row.dim_width_cm,
      h: row.dim_height_cm,
    },
    cbmPerUnit: Number(row.cbm_per_unit),
    weightKg: Number(row.weight_kg),
    moqUnits: row.moq_units,
    basePriceHt: Number(row.base_price_ht),
    retailPriceRef: Number(row.retail_price_ref),
    ecoContribution: Number(row.eco_contribution),
    mainImageUrl: row.main_image_url,
    galleryUrls: [...(row.gallery_urls ?? [])],
    features: [...(row.features ?? [])],
    fireRating: row.fire_rating ?? undefined,
    variants: [...variants],
  }
}

function seriesReachedFor(products: ReadonlyArray<Product>): number {
  return products.filter((product) => {
    const committed = product.variants.reduce(
      (sum, variant) => sum + variant.unitsCommitted,
      0,
    )
    return committed >= product.moqUnits
  }).length
}

function containerFromRow(
  row: ContainerRow,
  seriesReached: number,
): DbCurrentContainer {
  return {
    id: row.id,
    reference: row.reference,
    port: row.port,
    capacityCbm: Number(row.capacity_cbm),
    thresholdPercent: row.threshold_percent,
    minSeriesRequired: row.min_series_required,
    expectedCloseAt: row.expected_close_at,
    status: 'open',
    seriesReached,
    totalSeries: row.display_series_target,
    professionalsEngaged: row.display_pros_count,
    containerType: row.container_type ?? '20_hc',
  }
}

export async function fetchCatalogFromDb(
  client: CatalogueDbClient,
): Promise<DbCatalog> {
  // Run the three independent queries in parallel; the commitments query
  // can only start once we know which container is open, so it is awaited
  // separately below.
  const [productsResult, variantsResult, containerResult] = await Promise.all([
    client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    client
      .from('product_variants')
      .select('*')
      .order('sort_order', { ascending: true }),
    client
      .from('containers')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (productsResult.error) throw new Error(productsResult.error.message)
  if (variantsResult.error) throw new Error(variantsResult.error.message)
  if (containerResult.error) throw new Error(containerResult.error.message)

  const containerRow = containerResult.data?.[0] ?? null

  // The unitsCommitted snapshot is per-container — without a current container
  // there is no meaningful "engaged units" value to display, but we can
  // still surface the catalogue itself (with zero commitments).
  const commitmentsResult = containerRow
    ? await client
        .from('container_seed_commitments')
        .select('*')
        .eq('container_id', containerRow.id)
    : { data: [] as ReadonlyArray<CommitmentRow>, error: null }

  if (commitmentsResult.error) {
    throw new Error(commitmentsResult.error.message)
  }

  const committedByVariant = new Map<string, number>()
  for (const row of commitmentsResult.data ?? []) {
    committedByVariant.set(row.variant_id, row.units_committed)
  }

  const variantsByProduct = new Map<string, DesignVariant[]>()
  for (const row of variantsResult.data ?? []) {
    const list = variantsByProduct.get(row.product_id) ?? []
    list.push(variantFromRow(row, committedByVariant.get(row.id) ?? 0))
    variantsByProduct.set(row.product_id, list)
  }

  const products: Product[] = (productsResult.data ?? [])
    .map((row) =>
      productFromRow(row, variantsByProduct.get(row.id) ?? []),
    )
    .filter((product) => product.variants.length > 0)

  const currentContainer = containerRow
    ? containerFromRow(containerRow, seriesReachedFor(products))
    : null

  return { products, currentContainer }
}
