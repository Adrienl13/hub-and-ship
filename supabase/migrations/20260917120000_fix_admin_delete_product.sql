-- 43. La suppression définitive d'un produit ne partait jamais.
--
-- Symptôme constaté dans l'espace admin (onglet Catalogue) : on clique
-- « Supprimer » sur une ligne désactivée, on confirme, et il ne se passe
-- rien — la ligne reste affichée.
--
-- Cause : public.admin_delete_product() (migration 20260823100000) lit
-- public.container_reservation_items pour refuser la suppression d'un
-- produit déjà réservé. Cette table n'existe pas en production : le schéma
-- distant nomme la table reservation_items (le renommage de la migration
-- 20260520101823 n'a jamais été rejoué là-bas). PL/pgSQL ne résout les
-- tables qu'à l'exécution : la fonction compilait, puis échouait à chaque
-- appel sur « relation "container_reservation_items" does not exist ».
-- L'erreur remontait bien à l'interface, mais dans le bandeau en haut de
-- l'onglet, hors écran quand on supprime une ligne en bas de liste : d'où
-- l'impression que le bouton ne faisait rien.
--
-- Correctif : la fonction ne cite plus aucune table en dur. Elle cherche
-- celle qui existe (container_reservation_items OU reservation_items) et
-- n'interroge que celle-là, en SQL dynamique ; si aucune n'est présente,
-- elle continue au lieu d'exploser. Même traitement pour les tables
-- satellites sans clé étrangère, dont la présence varie entre le schéma
-- local et le schéma distant.
--
-- Au passage, le nettoyage est complété. Les références suivantes ne sont
-- couvertes par aucune clé étrangère et laissaient des orphelins :
--   product_partner_prices      (déjà purgée)
--   partner_selection_items     (sélections partenaires)
--   stock_requests              (demandes de réappro)
--   showroom_locations.product_skus  (tableau de SKU)
--   studio_curation_sets.product_ids (tableau d'identifiants)
--
-- Aucune donnée n'est modifiée par cette migration : elle remplace
-- uniquement le corps de la fonction. Rejouable sans effet.

create or replace function public.admin_delete_product(p_product_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sku text;
  v_reservation_table text;
  v_reservation_refs integer := 0;
  v_partner_prices integer := 0;
  v_selection_items integer := 0;
  v_stock_requests integer := 0;
  v_showrooms integer := 0;
  v_curation_sets integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_delete_product: admin only';
  end if;

  if p_product_id is null or btrim(p_product_id) = '' then
    raise exception 'admin_delete_product: product id requis';
  end if;

  select sku into v_sku from public.products where id = p_product_id;

  if not found then
    raise exception 'admin_delete_product: produit % introuvable', p_product_id;
  end if;

  -- Historique commercial : le nom de la table diffère selon le schéma
  -- (container_reservation_items en local, reservation_items en production).
  -- On interroge celle qui existe, sans jamais citer l'autre.
  v_reservation_table := coalesce(
    to_regclass('public.container_reservation_items')::text,
    to_regclass('public.reservation_items')::text
  );

  if v_reservation_table is not null then
    execute format(
      'select count(*) from %s where product_id = $1', v_reservation_table
    ) into v_reservation_refs using p_product_id;
  end if;

  if v_reservation_refs > 0 then
    raise exception
      'Ce produit est référencé par % ligne(s) de réservation : il fait partie de l''historique commercial. Désactivez-le au lieu de le supprimer.',
      v_reservation_refs;
  end if;

  -- Tables satellites sans clé étrangère vers products : purge manuelle.
  if to_regclass('public.product_partner_prices') is not null then
    delete from public.product_partner_prices where product_id = p_product_id;
    get diagnostics v_partner_prices = row_count;
  end if;

  if to_regclass('public.partner_selection_items') is not null then
    execute 'delete from public.partner_selection_items where product_id = $1'
      using p_product_id;
    get diagnostics v_selection_items = row_count;
  end if;

  if to_regclass('public.stock_requests') is not null then
    execute 'delete from public.stock_requests where product_id = $1'
      using p_product_id;
    get diagnostics v_stock_requests = row_count;
  end if;

  -- Tableaux d'identifiants : on retire l'entrée, on ne supprime pas la ligne.
  if v_sku is not null and to_regclass('public.showroom_locations') is not null then
    execute 'update public.showroom_locations
                set product_skus = array_remove(product_skus, $1)
              where $1 = any(product_skus)'
      using v_sku;
    get diagnostics v_showrooms = row_count;
  end if;

  if to_regclass('public.studio_curation_sets') is not null then
    execute 'update public.studio_curation_sets
                set product_ids = array_remove(product_ids, $1)
              where $1 = any(product_ids)'
      using p_product_id;
    get diagnostics v_curation_sets = row_count;
  end if;

  -- Cascade via FK : product_variants (→ stock_lines, seed_commitments),
  -- product_reviews, channel_price_overrides, product_pricing_inputs,
  -- product_favorites, studio_product_profiles, studio_fulfillment_options,
  -- studio_diagnostic_pairs. studio_events passe à null.
  delete from public.products where id = p_product_id;

  return jsonb_build_object(
    'ok', true,
    'deleted_id', p_product_id,
    'deleted_sku', v_sku,
    'cleaned', jsonb_build_object(
      'product_partner_prices', v_partner_prices,
      'partner_selection_items', v_selection_items,
      'stock_requests', v_stock_requests,
      'showroom_locations', v_showrooms,
      'studio_curation_sets', v_curation_sets
    )
  );
end;
$function$;

comment on function public.admin_delete_product(text) is
  'Suppression définitive d''un produit, réservée aux admins. Refuse si le produit apparaît dans une réservation (historique commercial). Purge les références sans clé étrangère avant le delete. Tolère l''absence des tables satellites : le schéma local et le schéma distant divergent.';

grant execute on function public.admin_delete_product(text) to authenticated;
