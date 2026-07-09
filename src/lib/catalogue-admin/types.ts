import type { ProductCategory } from '@/lib/products'
import type { Database, FireRatingDb } from '@/lib/supabase/types'

export type ProductRow = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type ProductVariantRow =
  Database['public']['Tables']['product_variants']['Row']
export type ProductVariantInsert =
  Database['public']['Tables']['product_variants']['Insert']
export type ProductPartnerPriceRow =
  Database['public']['Tables']['product_partner_prices']['Row']
export type ProductPricingInputRow =
  Database['public']['Tables']['product_pricing_inputs']['Row']
export type PricingParameterRow =
  Database['public']['Tables']['pricing_parameters']['Row']
export type PricingParameterUpdate =
  Database['public']['Tables']['pricing_parameters']['Update']

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
  readonly fobUsd: number | null
  readonly qtyPerContainer: number | null
  readonly isLossLeader: boolean
  readonly tablePriceModifierRate: number | null
  readonly partnerNetPriceHt: number | null
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
  readonly imageUrl: string | null
  readonly galleryUrls: ReadonlyArray<string>
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

export interface AdminPricingParameters {
  readonly id: string
  readonly version: number
  readonly label: string
  readonly fxUsdEur: number
  readonly freightEur40hc: number
  readonly usefulContainerCbm40hc: number
  readonly customsRate: number
  readonly importInsuranceRate: number
  readonly fixedImportFeeEur: number
  readonly directMarginRate: number
  readonly resellerMarginRate: number
  readonly distributorMarginRate: number
  readonly minMarginFloor: number
  readonly lossLeaderMinLot: number
  readonly tier2Qty: number
  readonly tier2Discount: number
  readonly tier3Qty: number
  readonly tier3Discount: number
  readonly reservationFeeRate: number
  readonly reservationFeeMin: number
  readonly reservationFeeMax: number
  readonly updatedAt: string
}

export function fromProductRow(
  row: ProductRow,
  variantsCount = 0,
  partnerNetPriceHt: number | null = null,
  pricingInput: ProductPricingInputRow | null = null,
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
    fobUsd:
      pricingInput?.fob_usd === null || pricingInput?.fob_usd === undefined
        ? null
        : Number(pricingInput.fob_usd),
    qtyPerContainer: pricingInput?.qty_per_container ?? null,
    isLossLeader: pricingInput?.is_loss_leader ?? false,
    tablePriceModifierRate:
      pricingInput?.table_price_modifier_rate === null ||
      pricingInput?.table_price_modifier_rate === undefined
        ? null
        : Number(pricingInput.table_price_modifier_rate),
    partnerNetPriceHt,
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
    imageUrl: row.image_url,
    galleryUrls: row.gallery_urls ?? [],
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

export function fromPricingParameterRow(
  row: PricingParameterRow,
): AdminPricingParameters {
  return {
    id: row.id,
    version: row.version,
    label: row.label,
    fxUsdEur: Number(row.fx_usd_eur),
    freightEur40hc: Number(row.freight_eur_40hc),
    usefulContainerCbm40hc: Number(row.useful_container_cbm_40hc),
    customsRate: Number(row.customs_rate),
    importInsuranceRate: Number(row.import_insurance_rate),
    fixedImportFeeEur: Number(row.fixed_import_fee_eur),
    directMarginRate: Number(row.direct_margin_rate),
    resellerMarginRate: Number(row.reseller_margin_rate),
    distributorMarginRate: Number(row.distributor_margin_rate),
    minMarginFloor: Number(row.min_margin_floor),
    lossLeaderMinLot: row.loss_leader_min_lot,
    tier2Qty: row.tier2_qty,
    tier2Discount: Number(row.tier2_discount),
    tier3Qty: row.tier3_qty,
    tier3Discount: Number(row.tier3_discount),
    reservationFeeRate: Number(row.reservation_fee_rate),
    reservationFeeMin: Number(row.reservation_fee_min),
    reservationFeeMax: Number(row.reservation_fee_max),
    updatedAt: row.updated_at,
  }
}
