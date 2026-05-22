import type { ProductCategory } from '@/lib/products'
import type { Database, FireRatingDb } from '@/lib/supabase/types'

export type ProductRow = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type ProductVariantRow =
  Database['public']['Tables']['product_variants']['Row']
export type ProductVariantInsert =
  Database['public']['Tables']['product_variants']['Insert']

export type SeedCommitmentRow =
  Database['public']['Tables']['container_seed_commitments']['Row']

export interface AdminProduct {
  readonly id: string
  readonly sku: string
  readonly category: ProductCategory
  readonly name: string
  readonly description: string
  readonly dimensions: { l: number; w: number; h: number }
  readonly cbmPerUnit: number
  readonly weightKg: number
  readonly moqUnits: number
  readonly basePriceHt: number
  readonly retailPriceRef: number
  readonly ecoContribution: number
  readonly mainImageUrl: string
  readonly galleryUrls: ReadonlyArray<string>
  readonly features: ReadonlyArray<string>
  readonly fireRating: FireRatingDb | null
  readonly isActive: boolean
  readonly sortOrder: number
  readonly variantsCount: number
}

export interface AdminProductVariant {
  readonly id: string
  readonly productId: string
  readonly name: string
  readonly hex: string
  readonly imageUrl: string | null
  readonly sortOrder: number
}

export interface AdminProductDetail extends AdminProduct {
  readonly variants: ReadonlyArray<AdminProductVariant>
}

export interface AdminContainerOption {
  readonly id: string
  readonly reference: string
}

export interface AdminSeedCommitment {
  readonly containerId: string
  readonly variantId: string
  readonly unitsCommitted: number
}

export function fromProductRow(
  row: ProductRow,
  variantsCount = 0,
): AdminProduct {
  return {
    id: row.id,
    sku: row.sku,
    category: row.category,
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
    galleryUrls: row.gallery_urls ?? [],
    features: row.features ?? [],
    fireRating: row.fire_rating,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    variantsCount,
  }
}

export function fromVariantRow(row: ProductVariantRow): AdminProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    hex: row.hex,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
  }
}

export function fromCommitmentRow(row: SeedCommitmentRow): AdminSeedCommitment {
  return {
    containerId: row.container_id,
    variantId: row.variant_id,
    unitsCommitted: row.units_committed,
  }
}
