// Fabriques de données de test pour la fondation Studio. Aucune valeur ici
// n'est une vérité commerciale : ce sont des fixtures.

import type { DesignVariant } from '@/lib/products'
import type {
  DataQuality,
  FulfillmentOption,
  StockAvailability,
  StudioProduct,
  StudioProjectItem,
} from './types'

export function variant(id: string, overrides: Partial<DesignVariant> = {}): DesignVariant {
  return {
    id,
    name: id,
    imageUrl: `/img/${id}.webp`,
    unitsCommitted: 0,
    minOrderUnits: null,
    ...overrides,
  }
}

export function seat(
  id: string,
  overrides: Partial<StudioProduct> & { readonly dataQuality?: DataQuality } = {},
): StudioProduct {
  const { dataQuality, studio, ...rest } = overrides
  return {
    id,
    sku: id.toUpperCase(),
    category: 'chair',
    name: `Chaise ${id}`,
    description: '',
    dimensions: { l: 48, w: 56, h: 86 },
    cbmPerUnit: 0.08,
    weightKg: 4.3,
    moqUnits: 50,
    basePriceHt: 62,
    retailPriceRef: 99,
    ecoContribution: 0,
    mainImageUrl: `/img/${id}.webp`,
    galleryUrls: [],
    variants: [variant(`${id}-std`)],
    features: [],
    visibility: 'public',
    isActive: true,
    studio: {
      studioRole: 'seat',
      seatKind: 'chair',
      material: 'pe_weave',
      modelFamilyId: null,
      visualTraits: null,
      dataQuality: dataQuality ?? {
        price: { status: 'verified', source: 'catalogue_public_price' },
        dimensions: { status: 'estimated', source: 'family_mode' },
      },
      ...studio,
    },
    ...rest,
  }
}

export function item(
  productId: string,
  requestedQuantity: number,
  overrides: Partial<StudioProjectItem> = {},
): StudioProjectItem {
  return {
    productId,
    variantId: `${productId}-std`,
    requestedQuantity,
    role: 'seat',
    ...overrides,
  }
}

export function stock(
  productId: string,
  availableUnits: number,
  overrides: Partial<StockAvailability> = {},
): StockAvailability {
  return {
    stockLineId: `stock-${productId}`,
    productId,
    variantId: `${productId}-std`,
    availableUnits,
    stockPriceHt: 70,
    ...overrides,
  }
}

export function option(
  productId: string,
  mode: FulfillmentOption['mode'],
  overrides: Partial<FulfillmentOption> = {},
): FulfillmentOption {
  return {
    id: `opt-${productId}-${mode}`,
    productId,
    variantId: null,
    mode,
    minQuantity: mode === 'standard_production' ? 50 : null,
    maxQuantity: null,
    priceBasis: 'container',
    isActive: true,
    confirmedBy: null,
    availableFrom: null,
    expiresAt: null,
    ...overrides,
  }
}
