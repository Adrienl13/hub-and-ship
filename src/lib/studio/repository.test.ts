import { describe, expect, it } from 'vitest'

import { INTERNAL_PRODUCT_COST_COLUMNS, PUBLIC_PRODUCT_COLUMNS } from '@/lib/catalogue/product-columns'
import {
  FULFILLMENT_OPTION_SELECT,
  STOCK_SELECT,
  STUDIO_PRODUCT_SELECT,
  VARIANT_SELECT,
  fetchStudioCatalog,
  type StudioDbClient,
  type StudioDbTable,
} from './repository'

type Row = Record<string, unknown>

interface Call {
  readonly table: StudioDbTable
  readonly columns: string
  readonly filters: Array<[string, unknown]>
}

function fakeClient(rows: Partial<Record<StudioDbTable, ReadonlyArray<Row>>>, calls: Call[]): StudioDbClient {
  const client = {
    from(table: StudioDbTable) {
      return {
        select(columns: string) {
          const call: Call = { table, columns, filters: [] }
          calls.push(call)
          const builder = {
            eq(column: string, value: unknown) {
              call.filters.push([column, value])
              return builder
            },
            gt(column: string, value: number) {
              call.filters.push([`${column}>`, value])
              return builder
            },
            order() {
              return builder
            },
            limit() {
              return builder
            },
            then<R>(onFulfilled: (value: { data: ReadonlyArray<Row> | null; error: null }) => R) {
              return Promise.resolve({ data: rows[table] ?? [], error: null }).then(onFulfilled)
            },
          }
          return builder
        },
      }
    },
  }
  return client as unknown as StudioDbClient
}

const productRow: Row = {
  id: 'bis-001',
  sku: 'BIS-001',
  category: 'chair',
  name: 'Chaise de bistrot RIVOLI',
  description: '',
  dim_length_cm: 46,
  dim_width_cm: 57,
  dim_height_cm: 85,
  cbm_per_unit: '0.08',
  weight_kg: '4.3',
  moq_units: 50,
  base_price_ht: '62.00',
  retail_price_ref: '89.00',
  eco_contribution: '0',
  main_image_url: '/img/bis-001.webp',
  gallery_urls: [],
  features: ['Chaise bistrot'],
  fire_rating: 'M2',
  is_active: true,
  sort_order: 1,
  created_at: 'x',
  updated_at: 'x',
  table_shape: null,
  compatible_top_shapes: [],
  visibility: 'public',
  studio_role: 'seat',
  seat_kind: 'chair',
  material: 'pe_weave',
  model_family_id: null,
  visual_traits: null,
  data_quality: {
    price: { status: 'verified', source: 'catalogue_public_price' },
    material: { status: 'verified', source: 'sku_prefix' },
  },
}

describe('repository Studio', () => {
  it('lit studio_products avec des colonnes explicites, jamais *, jamais une colonne de coût', () => {
    expect(STUDIO_PRODUCT_SELECT).not.toContain('*')
    for (const column of PUBLIC_PRODUCT_COLUMNS) expect(STUDIO_PRODUCT_SELECT).toContain(column)
    for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) expect(STUDIO_PRODUCT_SELECT).not.toContain(hidden)
    for (const projection of [VARIANT_SELECT, FULFILLMENT_OPTION_SELECT, STOCK_SELECT]) {
      expect(projection).not.toContain('*')
    }
  })

  it('assemble produits, variantes, options, stock réel et signal de production', async () => {
    const calls: Call[] = []
    const client = fakeClient(
      {
        studio_products: [productRow],
        product_variants: [
          { id: 'bis-001-std', product_id: 'bis-001', name: 'Standard', image_url: '/v.webp', gallery_urls: [], sort_order: 0, min_order_units: null },
        ],
        studio_fulfillment_options: [
          { id: 'opt-1', product_id: 'bis-001', variant_id: null, mode: 'standard_production', min_quantity: 50, max_quantity: null, price_basis: 'container', is_active: true, confirmed_by: null, available_from: null, expires_at: null },
          { id: 'opt-2', product_id: 'bis-001', variant_id: null, mode: 'stock', min_quantity: null, max_quantity: null, price_basis: 'stock', is_active: true, confirmed_by: null, available_from: null, expires_at: null },
        ],
        stock_lines: [
          { id: 'stock-1', product_id: 'bis-001', variant_id: 'bis-001-std', available_units: 12, stock_price_ht: '70' },
        ],
        containers: [{ id: 'c1' }],
      },
      calls,
    )

    const catalog = await fetchStudioCatalog(client)
    expect(catalog.source).toBe('db')
    expect(catalog.products).toHaveLength(1)
    const product = catalog.products[0]!
    expect(product.sku).toBe('BIS-001')
    expect(product.isActive).toBe(true)
    expect(product.basePriceHt).toBe(62)
    expect(product.studio.studioRole).toBe('seat')
    expect(product.studio.modelFamilyId).toBeNull()
    // Heuristique marquée verified en base → estimée côté code.
    expect(product.studio.dataQuality.material).toMatchObject({ status: 'estimated', source: 'sku_prefix' })
    expect(product.studio.dataQuality.price?.status).toBe('verified')
    expect(product.variants[0]?.unitsCommitted).toBe(0)

    // Une option « stock » déclarée en base est ignorée : le stock vient de stock_lines.
    expect(catalog.context.options.map((option) => option.id)).toEqual(['opt-1'])
    expect(catalog.context.stock).toEqual([
      { stockLineId: 'stock-1', productId: 'bis-001', variantId: 'bis-001-std', availableUnits: 12, stockPriceHt: 70 },
    ])
    expect(catalog.context.productionOpen).toBe(true)

    const productCall = calls.find((call) => call.table === 'studio_products')
    expect(productCall?.columns).toBe(STUDIO_PRODUCT_SELECT)
    expect(productCall?.filters).toEqual([['is_active', true]])
    const stockCall = calls.find((call) => call.table === 'stock_lines')
    expect(stockCall?.filters).toEqual([['is_active', true], ['available_units>', 0]])
  })

  it('exclut un produit sans variante et tolère un profil absent', async () => {
    const calls: Call[] = []
    const client = fakeClient(
      {
        studio_products: [
          { ...productRow, id: 'sans-variante', sku: 'X-1' },
          { ...productRow, id: 'p2', sku: 'X-2', studio_role: null, seat_kind: 'bizarre', data_quality: null },
        ],
        product_variants: [{ id: 'p2-std', product_id: 'p2', name: 'Standard', image_url: null, gallery_urls: null, sort_order: 0, min_order_units: null }],
        studio_fulfillment_options: [],
        stock_lines: [],
        containers: [],
      },
      calls,
    )
    const catalog = await fetchStudioCatalog(client)
    expect(catalog.products.map((product) => product.id)).toEqual(['p2'])
    expect(catalog.products[0]?.studio).toMatchObject({ studioRole: 'catalog_only', seatKind: null, dataQuality: {} })
    expect(catalog.context.productionOpen).toBe(false)
  })
})
