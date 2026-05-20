import {
  CATEGORY_LABEL,
  PRODUCTS,
  type Product,
  type ProductCategory,
} from '@/lib/products'

export type StockCondition = 'new' | 'opened_box' | 'showroom'
export type StockFilter = 'all' | ProductCategory
export type StockSortKey = 'priority' | 'available-desc' | 'price-asc'

export interface AvailableStockItem {
  readonly id: string
  readonly productId: string
  readonly variantId: string
  readonly availableUnits: number
  readonly reservedUnits: number
  readonly stockPriceHt: number
  readonly location: string
  readonly readyLabel: string
  readonly condition: StockCondition
  readonly priority: number
  readonly note: string
}

export interface StockLine {
  readonly id: string
  readonly product: Product
  readonly variant: Product['variants'][number]
  readonly availableUnits: number
  readonly reservedUnits: number
  readonly stockPriceHt: number
  readonly location: string
  readonly readyLabel: string
  readonly condition: StockCondition
  readonly priority: number
  readonly note: string
}

export interface StockKpis {
  readonly references: number
  readonly availableUnits: number
  readonly reservedUnits: number
  readonly totalValueHt: number
}

export const STOCK_CONDITION_LABEL: Record<StockCondition, string> = {
  new: 'Neuf',
  opened_box: 'Carton ouvert',
  showroom: 'Exposition',
}

export const STOCK_FILTERS: ReadonlyArray<{
  readonly id: StockFilter
  readonly label: string
}> = [
  { id: 'all', label: 'Tout' },
  { id: 'chair', label: 'Chaises' },
  { id: 'armchair', label: 'Fauteuils' },
  { id: 'table', label: 'Tables' },
  { id: 'bench', label: 'Bancs' },
] as const

export const AVAILABLE_STOCK: ReadonlyArray<AvailableStockItem> = [
  {
    id: 'stock-cannes-noir',
    productId: 'p1',
    variantId: 'v1a',
    availableUnits: 86,
    reservedUnits: 12,
    stockPriceHt: 109,
    location: 'Marseille-Fos',
    readyLabel: 'Retrait sous 24h',
    condition: 'new',
    priority: 1,
    note: 'Lot homogène, cartons complets, idéal terrasse à ouvrir rapidement.',
  },
  {
    id: 'stock-monaco-anthracite',
    productId: 'p4',
    variantId: 'v4b',
    availableUnits: 64,
    reservedUnits: 0,
    stockPriceHt: 89,
    location: 'Marseille-Fos',
    readyLabel: 'Retrait sous 24h',
    condition: 'new',
    priority: 2,
    note: 'Assise légère, empilable, disponible sans attendre le prochain container.',
  },
  {
    id: 'stock-lyon-teck',
    productId: 'p3',
    variantId: 'v3a',
    availableUnits: 18,
    reservedUnits: 4,
    stockPriceHt: 225,
    location: 'Marseille-Fos',
    readyLabel: 'Retrait sous 24h',
    condition: 'opened_box',
    priority: 3,
    note: 'Quelques cartons ouverts pour contrôle qualité, mobilier non utilisé.',
  },
  {
    id: 'stock-malibu-naturel',
    productId: 'p2',
    variantId: 'v2c',
    availableUnits: 22,
    reservedUnits: 2,
    stockPriceHt: 295,
    location: 'Marseille-Fos',
    readyLabel: 'Retrait sous 24h',
    condition: 'showroom',
    priority: 4,
    note: 'Lot court pour compléter une zone lounge ou un besoin événementiel.',
  },
  {
    id: 'stock-marseille-ardoise',
    productId: 'p6',
    variantId: 'v6b',
    availableUnits: 9,
    reservedUnits: 0,
    stockPriceHt: 399,
    location: 'Marseille-Fos',
    readyLabel: 'Retrait sous 24h',
    condition: 'new',
    priority: 5,
    note: 'Tables rectangulaires en quantité limitée, adaptées aux terrasses 6 places.',
  },
] as const

function requireProduct(id: string): Product {
  const product = PRODUCTS.find((item) => item.id === id)
  if (!product) throw new Error(`Missing stock product ${id}`)

  return product
}

export function resolveStockLine(item: AvailableStockItem): StockLine {
  const product = requireProduct(item.productId)
  const variant = product.variants.find((entry) => entry.id === item.variantId)

  if (!variant) {
    throw new Error(`Missing stock variant ${item.variantId}`)
  }

  return {
    ...item,
    product,
    variant,
  }
}

export function getAvailableStockLines(
  stock: ReadonlyArray<AvailableStockItem> = AVAILABLE_STOCK,
): ReadonlyArray<StockLine> {
  return stock.map(resolveStockLine)
}

export function productStockSearchText(line: StockLine): string {
  return [
    line.product.name,
    line.product.sku,
    CATEGORY_LABEL[line.product.category],
    line.variant.name,
    line.location,
    line.note,
  ]
    .join(' ')
    .toLocaleLowerCase('fr-FR')
}

export function filterAndSortStockLines({
  lines,
  filter,
  search,
  sort,
}: {
  readonly lines: ReadonlyArray<StockLine>
  readonly filter: StockFilter
  readonly search: string
  readonly sort: StockSortKey
}): ReadonlyArray<StockLine> {
  const query = search.trim().toLocaleLowerCase('fr-FR')
  let result = lines.filter((line) => {
    const categoryMatch = filter === 'all' || line.product.category === filter
    const searchMatch =
      query.length === 0 || productStockSearchText(line).includes(query)

    return categoryMatch && searchMatch
  })

  if (sort === 'available-desc') {
    result = [...result].sort((a, b) => b.availableUnits - a.availableUnits)
  } else if (sort === 'price-asc') {
    result = [...result].sort((a, b) => a.stockPriceHt - b.stockPriceHt)
  } else {
    result = [...result].sort((a, b) => a.priority - b.priority)
  }

  return result
}

export function getStockCategoryCounts(
  lines: ReadonlyArray<StockLine>,
): Record<StockFilter, number> {
  return lines.reduce<Record<StockFilter, number>>(
    (acc, line) => {
      acc.all += 1
      acc[line.product.category] += 1
      return acc
    },
    { all: 0, chair: 0, armchair: 0, table: 0, bench: 0 },
  )
}

export function calculateStockKpis(lines: ReadonlyArray<StockLine>): StockKpis {
  return {
    references: lines.length,
    availableUnits: lines.reduce((sum, line) => sum + line.availableUnits, 0),
    reservedUnits: lines.reduce((sum, line) => sum + line.reservedUnits, 0),
    totalValueHt: lines.reduce(
      (sum, line) => sum + line.availableUnits * line.stockPriceHt,
      0,
    ),
  }
}
