// Classification des colonnes de `products` : PUBLIQUES (lisibles par
// anon et par tout compte connecté, via la vue products_public ou en
// sélection explicite) et INTERNES (coûts fournisseur hérités : jamais
// lisibles hors admin ; les vrais coûts vivent dans product_pricing_inputs).
//
// Cette liste est la SOURCE UNIQUE partagée par :
// - les grants colonne par colonne des migrations 37 (anon) et 38
//   (authenticated) — le test tests/security/products-cost-columns-grants
//   vérifie la parité migration ↔ liste ;
// - les sélections explicites côté admin (catalogue-admin/repository.ts),
//   puisque `select('*')` échoue dès qu'une colonne n'est pas accordée ;
// - le type de ligne du catalogue public (catalogue/db.ts).
//
// Ajouter une colonne à `products` : voir docs/RUNBOOK_SECURITY_GRANTS.md.

import type { Database } from '@/lib/supabase/types'

export const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'sku',
  'category',
  'name',
  'description',
  'dim_length_cm',
  'dim_width_cm',
  'dim_height_cm',
  'cbm_per_unit',
  'weight_kg',
  'moq_units',
  'base_price_ht',
  'retail_price_ref',
  'eco_contribution',
  'main_image_url',
  'gallery_urls',
  'features',
  'fire_rating',
  'is_active',
  'sort_order',
  'created_at',
  'updated_at',
  'table_shape',
  'compatible_top_shapes',
  'visibility',
] as const

export const INTERNAL_PRODUCT_COST_COLUMNS = [
  'fob_usd',
  'qty_per_container',
  'is_loss_leader',
  'table_price_modifier_rate',
] as const

export type PublicProductColumn = (typeof PUBLIC_PRODUCT_COLUMNS)[number]
export type InternalProductCostColumn =
  (typeof INTERNAL_PRODUCT_COST_COLUMNS)[number]

/** Projection PostgREST à utiliser à la place de `*` sur `products`. */
export const PUBLIC_PRODUCT_SELECT: string = PUBLIC_PRODUCT_COLUMNS.join(', ')

type ProductRowKeys = keyof Database['public']['Tables']['products']['Row']
type UnclassifiedColumn = Exclude<
  ProductRowKeys,
  PublicProductColumn | InternalProductCostColumn
>

/**
 * Garde de compilation : toute colonne ajoutée au type `products.Row` doit
 * être rangée soit dans PUBLIC_PRODUCT_COLUMNS soit dans
 * INTERNAL_PRODUCT_COST_COLUMNS, sinon ce fichier ne compile plus.
 */
export const EVERY_PRODUCT_COLUMN_IS_CLASSIFIED: UnclassifiedColumn extends never
  ? true
  : false = true
