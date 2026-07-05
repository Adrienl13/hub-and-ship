import {
  CATEGORY_LABEL,
  PRODUCTS,
  type Product,
  type ProductCategory,
} from '@/lib/products'

export const CATEGORY_FILTERS: Array<{
  id: 'all' | ProductCategory
  label: string
}> = [
  { id: 'all', label: 'Tous' },
  { id: 'chair', label: 'Chaise' },
  { id: 'armchair', label: 'Fauteuil' },
  { id: 'table', label: 'Table' },
  { id: 'bench', label: 'Banc' },
]

export type CatalogueFilter = 'all' | ProductCategory
export type SortKey =
  | 'default'
  | 'price-asc'
  | 'price-desc'
  | 'cbm-asc'
  | 'popular'

export const PAGE_SIZE_OPTIONS = [30, 60, 90] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export function getDefaultVariant(product: Product) {
  const variant = product.variants[0]

  if (!variant) {
    throw new Error(`Product ${product.id} must define at least one variant`)
  }

  return variant
}

export function productSearchText(product: Product) {
  return [
    product.name,
    product.sku,
    CATEGORY_LABEL[product.category],
    product.description,
    ...product.features,
    ...product.variants.map((variant) => variant.name),
  ]
    .join(' ')
    .toLocaleLowerCase('fr-FR')
}

export function getCategoryCounts(products: Product[] = PRODUCTS) {
  return products.reduce<Record<CatalogueFilter, number>>(
    (acc, product) => {
      acc.all += 1
      acc[product.category] += 1
      return acc
    },
    { all: 0, chair: 0, armchair: 0, table: 0, bench: 0 },
  )
}

export interface CatalogueAdvancedFilters {
  readonly maxPrice: number | null
  readonly maxMoq: number | null
  readonly fireM1Only: boolean
  readonly stackableOnly: boolean
}

export const EMPTY_ADVANCED_FILTERS: CatalogueAdvancedFilters = {
  maxPrice: null,
  maxMoq: null,
  fireM1Only: false,
  stackableOnly: false,
}

export function isStackable(product: Product): boolean {
  return product.features.some((feature) =>
    feature.toLocaleLowerCase('fr-FR').includes('empil'),
  )
}

export function hasActiveAdvancedFilters(
  advanced: CatalogueAdvancedFilters,
): boolean {
  return (
    advanced.maxPrice !== null ||
    advanced.maxMoq !== null ||
    advanced.fireM1Only ||
    advanced.stackableOnly
  )
}

function matchesAdvanced(
  product: Product,
  advanced: CatalogueAdvancedFilters,
): boolean {
  if (advanced.maxPrice !== null && product.basePriceHt > advanced.maxPrice) {
    return false
  }
  if (advanced.maxMoq !== null && product.moqUnits > advanced.maxMoq) {
    return false
  }
  if (advanced.fireM1Only && product.fireRating !== 'M1') return false
  if (advanced.stackableOnly && !isStackable(product)) return false
  return true
}

export function filterAndSortProducts({
  products = PRODUCTS,
  filter,
  search,
  sort,
  advanced = EMPTY_ADVANCED_FILTERS,
}: {
  products?: Product[]
  filter: CatalogueFilter
  search: string
  sort: SortKey
  advanced?: CatalogueAdvancedFilters
}) {
  const query = search.trim().toLocaleLowerCase('fr-FR')
  let list = products.filter((product) => {
    const categoryMatch = filter === 'all' || product.category === filter
    const searchMatch =
      query.length === 0 || productSearchText(product).includes(query)
    return categoryMatch && searchMatch && matchesAdvanced(product, advanced)
  })

  if (sort === 'price-asc') {
    list = [...list].sort((a, b) => a.basePriceHt - b.basePriceHt)
  } else if (sort === 'price-desc') {
    list = [...list].sort((a, b) => b.basePriceHt - a.basePriceHt)
  } else if (sort === 'cbm-asc') {
    list = [...list].sort((a, b) => a.cbmPerUnit - b.cbmPerUnit)
  } else if (sort === 'popular') {
    list = [...list].sort(
      (a, b) =>
        b.variants.reduce((sum, variant) => sum + variant.unitsCommitted, 0) -
        a.variants.reduce((sum, variant) => sum + variant.unitsCommitted, 0),
    )
  }

  return list
}
