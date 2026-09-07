-- 37. Correctif catalogue public : la vue products_public est en
-- security_invoker, donc anon doit pouvoir lire les colonnes non sensibles
-- de products (la révocation globale de la migration 31 rendait la vue et
-- product_variants illisibles pour les visiteurs — catalogue vide et fiches
-- produit en 404 pour tout visiteur non connecté). Les colonnes de coût
-- (fob_usd, qty_per_container, is_loss_leader, table_price_modifier_rate)
-- restent hors de portée d'anon : `select *` sur products échoue toujours.
grant select (
  id, sku, category, name, description,
  dim_length_cm, dim_width_cm, dim_height_cm,
  cbm_per_unit, weight_kg, moq_units,
  base_price_ht, retail_price_ref, eco_contribution,
  main_image_url, gallery_urls, features, fire_rating,
  is_active, sort_order, created_at, updated_at,
  table_shape, compatible_top_shapes, visibility
) on public.products to anon;
