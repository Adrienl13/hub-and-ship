import { describe, expect, it } from 'vitest'

import { INTERNAL_PRODUCT_COST_COLUMNS, PUBLIC_PRODUCT_COLUMNS } from '@/lib/catalogue/product-columns'
import {
  FULFILLMENT_OPTION_SELECT,
  STOCK_SELECT,
  STUDIO_INTERNAL_COLUMNS,
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

const optionBase = {
  product_id: 'bis-001',
  variant_id: null,
  min_quantity: 50,
  max_quantity: null,
  price_basis: 'container',
  source: 'seed_moq',
  is_active: true,
  available_from: null,
  expires_at: null,
}

describe('repository Studio', () => {
  it('lit des surfaces publiques avec des colonnes explicites, jamais *, jamais une colonne de coût ni interne', () => {
    for (const projection of [STUDIO_PRODUCT_SELECT, VARIANT_SELECT, FULFILLMENT_OPTION_SELECT, STOCK_SELECT]) {
      expect(projection).not.toContain('*')
      for (const hidden of INTERNAL_PRODUCT_COST_COLUMNS) expect(projection).not.toContain(hidden)
      for (const internal of STUDIO_INTERNAL_COLUMNS) {
        expect(projection.split(/,\s*/), internal).not.toContain(internal)
      }
    }
    for (const column of PUBLIC_PRODUCT_COLUMNS) expect(STUDIO_PRODUCT_SELECT).toContain(column)
    expect(FULFILLMENT_OPTION_SELECT).toContain('is_confirmed')
    expect(FULFILLMENT_OPTION_SELECT).not.toContain('confirmed_by')
  })

  it('assemble produits, variantes, options publiques et stock réel ; aucun signal container', async () => {
    const calls: Call[] = []
    const client = fakeClient(
      {
        studio_products: [productRow],
        product_variants: [
          { id: 'bis-001-std', product_id: 'bis-001', name: 'Standard', image_url: '/v.webp', gallery_urls: [], sort_order: 0, min_order_units: null },
        ],
        studio_fulfillment_options_public: [
          { ...optionBase, id: 'opt-1', mode: 'standard_production', is_confirmed: false },
          { ...optionBase, id: 'opt-2', mode: 'grouped_production', source: 'admin', min_quantity: 10, max_quantity: 40, is_confirmed: true },
          { ...optionBase, id: 'opt-3', mode: 'stock', price_basis: 'stock', is_confirmed: true },
          // Une valeur non booléenne ne confirme jamais.
          { ...optionBase, id: 'opt-4', mode: 'standard_production', source: 'admin', is_confirmed: 'true' },
        ],
        stock_lines: [
          { id: 'stock-1', product_id: 'bis-001', variant_id: 'bis-001-std', available_units: 12, stock_price_ht: '70' },
        ],
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
    expect(catalog.context.options.map((option) => [option.id, option.isConfirmed, option.source])).toEqual([
      ['opt-1', false, 'seed_moq'],
      ['opt-2', true, 'admin'],
      ['opt-4', false, 'admin'],
    ])
    expect(catalog.context.stock).toEqual([
      { stockLineId: 'stock-1', productId: 'bis-001', variantId: 'bis-001-std', availableUnits: 12, stockPriceHt: 70 },
    ])
    expect(catalog.context).not.toHaveProperty('productionOpen')

    const tables = calls.map((call) => call.table)
    expect(tables).toEqual([
      'studio_products',
      'product_variants',
      'studio_fulfillment_options_public',
      'stock_lines',
      'studio_curation_sets_public',
      'studio_diagnostic_pairs_public',
    ])
    expect(tables).not.toContain('containers')
    expect(tables).not.toContain('studio_fulfillment_options')
    expect(tables).not.toContain('studio_product_profiles')
    const productCall = calls.find((call) => call.table === 'studio_products')
    expect(productCall?.columns).toBe(STUDIO_PRODUCT_SELECT)
    expect(productCall?.filters).toEqual([['is_active', true]])
    const optionCall = calls.find((call) => call.table === 'studio_fulfillment_options_public')
    expect(optionCall?.columns).toBe(FULFILLMENT_OPTION_SELECT)
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
        studio_fulfillment_options_public: [],
        stock_lines: [],
      },
      calls,
    )
    const catalog = await fetchStudioCatalog(client)
    expect(catalog.products.map((product) => product.id)).toEqual(['p2'])
    expect(catalog.products[0]?.studio).toMatchObject({ studioRole: 'catalog_only', seatKind: null, dataQuality: {} })
    expect(catalog.context.options).toEqual([])
  })

  it('lit les jeux curés actifs et les paires vérifiées avec des colonnes explicites ; paires vides par défaut', async () => {
    const calls: Call[] = []
    const client = fakeClient(
      {
        studio_products: [productRow],
        product_variants: [{ id: 'bis-001-std', product_id: 'bis-001', name: 'Standard', image_url: null, gallery_urls: null, sort_order: 0, min_order_units: null }],
        studio_fulfillment_options_public: [],
        stock_lines: [],
        studio_curation_sets_public: [
          { id: 'pilot', label: 'Jeu pilote', product_ids: ['bis-001', 42, ''] },
          { id: null, label: 'invalide', product_ids: [] },
        ],
        studio_diagnostic_pairs_public: [
          { id: 'pair-1', product_a_id: 'bis-001', product_b_id: 'bis-002', axis: 'openness' },
          { id: 'pair-same', product_a_id: 'bis-001', product_b_id: 'bis-001', axis: 'openness' },
          { id: 'pair-bad', product_a_id: 'bis-001', product_b_id: null, axis: 'openness' },
        ],
      },
      calls,
    )
    const catalog = await fetchStudioCatalog(client)
    expect(catalog.curationSets).toEqual([{ id: 'pilot', label: 'Jeu pilote', productIds: ['bis-001'] }])
    expect(catalog.diagnosticPairs).toEqual([
      { id: 'pair-1', productAId: 'bis-001', productBId: 'bis-002', axis: 'openness' },
    ])
    expect(calls.find((call) => call.table === 'studio_curation_sets_public')?.columns).toBe('id, label, product_ids')
    expect(calls.find((call) => call.table === 'studio_diagnostic_pairs_public')?.columns).toBe('id, product_a_id, product_b_id, axis')
    for (const call of calls) {
      expect(call.columns).not.toContain('*')
      expect(call.columns).not.toMatch(/notes|created_by|verified_by/)
    }
  })

  it("se dégrade en listes vides si les surfaces du lot 2 n'existent pas encore", async () => {
    const client = {
      from(table: StudioDbTable) {
        return {
          select() {
            const builder = {
              eq: () => builder,
              gt: () => builder,
              order: () => builder,
              limit: () => builder,
              then<R>(onFulfilled: (value: { data: ReadonlyArray<Row> | null; error: { message: string } | null }) => R) {
                const missing = table === 'studio_curation_sets_public' || table === 'studio_diagnostic_pairs_public'
                return Promise.resolve(
                  missing
                    ? { data: null, error: { message: 'relation does not exist' } }
                    : { data: table === 'studio_products' ? [productRow] : table === 'product_variants' ? [{ id: 'bis-001-std', product_id: 'bis-001', name: 'Standard', image_url: null, gallery_urls: null, sort_order: 0, min_order_units: null }] : [], error: null },
                ).then(onFulfilled)
              },
            }
            return builder
          },
        }
      },
    } as unknown as StudioDbClient
    const catalog = await fetchStudioCatalog(client)
    expect(catalog.products).toHaveLength(1)
    expect(catalog.curationSets).toEqual([])
    expect(catalog.diagnosticPairs).toEqual([])
  })

  it("ne conserve aucune métadonnée interne de data_quality même si elle arrivait", async () => {
    const client = fakeClient(
      {
        studio_products: [
          { ...productRow, data_quality: { price: { status: 'verified', source: 'admin_input', by: 'uuid-admin', note: 'secret' } } },
        ],
        product_variants: [{ id: 'bis-001-std', product_id: 'bis-001', name: 'Standard', image_url: null, gallery_urls: null, sort_order: 0, min_order_units: null }],
        studio_fulfillment_options_public: [],
        stock_lines: [],
      },
      [],
    )
    const catalog = await fetchStudioCatalog(client)
    expect(JSON.stringify(catalog.products[0]?.studio.dataQuality)).not.toMatch(/uuid-admin|secret|"by"|"note"/)
  })
})
