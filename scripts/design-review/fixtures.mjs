/* global URL, localStorage */
// Synthetic commercial fixtures, only imported by the local review launcher.
import { readFileSync } from 'node:fs'
export const reviewProducts = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `seat-${i}`,
    name: `Assise démo ${i + 1}`,
    category: 'chair',
    studio_role: 'seat',
    table_shape: null,
    dim_length_cm: 48,
    dim_width_cm: 56,
    main_image_url: [
      '/catalogue/bistro-seating-clean/BIS-057-01.webp',
      '/catalogue/bistro-seating-clean/BIS-019-01.webp',
      '/catalogue/bistro-seating-clean/BIS-012-01.webp',
      '/catalogue/bistro-seating-clean/BIS-006-01.webp',
      '/catalogue/bistro-seating-clean/BIS-008-01.webp',
      '/catalogue/bistro-seating-clean/BIS-025-01.webp',
    ][i],
  })),
  {
    id: 'top',
    name: 'Plateau test 70',
    category: 'table_top',
    studio_role: 'tabletop',
    table_shape: 'rectangular',
    dim_length_cm: 70,
    dim_width_cm: 70,
    main_image_url: null,
  },
  {
    id: 'top-large',
    name: 'Plateau test 120',
    category: 'table_top',
    studio_role: 'tabletop',
    table_shape: 'rectangular',
    dim_length_cm: 120,
    dim_width_cm: 80,
    main_image_url: null,
  },
  {
    id: 'base',
    name: 'Piètement test validé',
    category: 'table_base',
    studio_role: 'base',
    table_shape: null,
    dim_length_cm: 45,
    dim_width_cm: 45,
    main_image_url: '/catalogue/table-base-series/TBA-001-01.webp',
  },
  {
    id: 'unknown',
    name: 'Piètement non confirmé',
    category: 'table_base',
    studio_role: 'base',
    table_shape: null,
    dim_length_cm: 45,
    dim_width_cm: 45,
    main_image_url: '/catalogue/table-base-series/TBA-003-01.webp',
  },
].map((p, i) => ({
  ...p,
  sku: p.id,
  description: 'Fixture E2E',
  dim_height_cm: 75,
  cbm_per_unit: 0.08,
  weight_kg: 5,
  moq_units: 50,
  base_price_ht: 62,
  retail_price_ref: 99,
  eco_contribution: 0,
  gallery_urls: [],
  features: [],
  is_active: true,
  sort_order: i,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  compatible_top_shapes: [],
  visibility: 'public',
  seat_kind: p.studio_role === 'seat' ? 'chair' : null,
  material: p.studio_role === 'seat' ? 'pe_weave' : null,
  model_family_id: null,
  visual_traits: null,
  data_quality: {
    price: { status: 'verified', source: 'catalogue_public_price' },
  },
}))

export function reviewRows(table) {
  let body = []
  if (table === 'studio_customization_capabilities_public')
    body = [
      {
        id: 'color',
        product_id: 'seat-0',
        scope: 'seat',
        kind: 'structure_color',
        status: 'verified',
        values: ['Bleu test'],
        allows_free_text: false,
        requires_review: false,
        min_quantity: null,
        max_quantity: null,
      },
      {
        id: 'rope',
        product_id: 'seat-0',
        scope: 'seat',
        kind: 'rope_color',
        status: 'on_request',
        values: ['Corde test'],
        allows_free_text: false,
        requires_review: true,
        min_quantity: null,
        max_quantity: null,
      },
      {
        id: 'unavailable',
        product_id: 'seat-0',
        scope: 'seat',
        kind: 'finish',
        status: 'unavailable',
        values: ['Impossible'],
        allows_free_text: false,
        requires_review: false,
        min_quantity: null,
        max_quantity: null,
      },
      {
        id: 'top-finish',
        product_id: 'top',
        scope: 'tabletop',
        kind: 'tabletop_finish',
        status: 'verified',
        values: ['Mat test'],
        allows_free_text: false,
        requires_review: false,
        min_quantity: null,
        max_quantity: null,
      },
    ]
  if (table === 'studio_visual_library_public')
    body = JSON.parse(
      readFileSync(
        new URL('../../public/studio/materials/library.json', import.meta.url),
        'utf8',
      ),
    )
  if (table === 'studio_products') body = reviewProducts
  if (table === 'product_variants')
    body = reviewProducts.map((p) => ({
      id: `${p.id}-std`,
      product_id: p.id,
      name: p.category === 'table_top' ? 'Marbre test' : 'Standard',
      image_url: p.main_image_url,
      gallery_urls: [],
      sort_order: 0,
      min_order_units: null,
    }))
  if (table === 'studio_tabletop_base_rules_public')
    body = [
      {
        id: 'rule',
        base_id: 'base',
        tabletop_id: 'top',
        base_type_id: null,
        shape: null,
        min_length_cm: null,
        min_width_cm: null,
        max_length_cm: null,
        max_width_cm: null,
        verdict: 'allowed',
      },
      {
        id: 'denied',
        base_id: 'base',
        tabletop_id: 'top-large',
        base_type_id: null,
        shape: null,
        min_length_cm: null,
        min_width_cm: null,
        max_length_cm: null,
        max_width_cm: null,
        verdict: 'denied',
      },
    ]

  return body
}
export function seedReviewProject() {
  if (localStorage.getItem('terrassea-studio-v1')) return
  localStorage.setItem(
    'terrassea-studio-v1',
    JSON.stringify({
      version: 5,
      state: {
        sessionId: 'lot5',
        algorithmVersion: 'v0.1',
        journal: [],
        discovery: { interactions: [], favoriteIds: [], finalistIds: [] },
        project: {
          entry: 'full_project',
          updatedAt: null,
          items: [
            {
              productId: 'seat-0',
              variantId: 'seat-0-std',
              role: 'seat',
              requestedQuantity: 60,
            },
            {
              productId: 'seat-1',
              variantId: 'seat-1-std',
              role: 'seat',
              requestedQuantity: 60,
            },
          ],
          tables: [
            {
              id: 'table-test',
              top: { productId: 'top', variantId: 'top-std' },
              base: { productId: 'base', variantId: 'base-std' },
              quantity: 30,
              quantityEdited: true,
              custom: null,
              verificationRequested: false,
              baseInvalidated: false,
            },
          ],
        },
      },
    }),
  )
}
