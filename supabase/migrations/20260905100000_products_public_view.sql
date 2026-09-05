-- Migration 30 — vue publique du catalogue SANS les colonnes de coût.
--
-- Constat pré-lancement : la policy « products are public » porte sur toutes
-- les colonnes et le client fait select('*'). Dès que l'admin renseigne
-- fob_usd (coût usine) ou qty_per_container, la clé anon publique peut les
-- lire via l'API REST — contraire à l'anonymisation fournisseur.
--
-- Étape 1 (non cassante, cette migration) : une vue products_public avec
-- security_invoker (les policies RLS de products s'appliquent : anon ne voit
-- que les produits actifs) et uniquement les colonnes publiques. Le client
-- catalogue (src/lib/catalogue/db.ts) lit désormais cette vue.
-- Étape 2 (migration 31, À APPLIQUER APRÈS le déploiement du bundle qui lit
-- la vue) : retirer le SELECT table-level de products au rôle anon.

create or replace view public.products_public
with (security_invoker = true) as
select
  id,
  sku,
  category,
  name,
  description,
  dim_length_cm,
  dim_width_cm,
  dim_height_cm,
  cbm_per_unit,
  weight_kg,
  moq_units,
  base_price_ht,
  retail_price_ref,
  eco_contribution,
  main_image_url,
  gallery_urls,
  features,
  fire_rating,
  is_active,
  sort_order,
  created_at,
  updated_at,
  table_shape
from public.products;

comment on view public.products_public is
  'Catalogue public : colonnes de products sans les coûts internes (fob_usd, qty_per_container, is_loss_leader, table_price_modifier_rate). security_invoker : RLS de products appliquée.';

grant select on public.products_public to anon, authenticated;
