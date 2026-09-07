-- 38. Hardening des coûts internes (lot 0.5 Studio, option A non destructive)
--
-- Constat : depuis la migration 31, `anon` ne lit `products` que colonne par
-- colonne (migration 37). `authenticated` gardait un `select` complet sur la
-- table, donc tout compte connecté NON admin pouvait lire les 4 colonnes de
-- coût héritées (fob_usd, qty_per_container, is_loss_leader,
-- table_price_modifier_rate). Elles sont vides aujourd'hui (les vrais coûts
-- sont dans product_pricing_inputs, admin only), mais la surface existe.
--
-- Correctif : même grant colonne par colonne pour `authenticated` que pour
-- `anon`. Aucune colonne supprimée, renommée ni modifiée. Les privilèges
-- d'écriture (insert/update/delete, filtrés par la RLS « admins write
-- products ») sont conservés : seul `select` est restreint.
--
-- L'admin est un utilisateur `authenticated` (rôle Postgres identique, seule
-- la RLS le distingue) : le code admin ne doit donc plus faire `select('*')`
-- sur products — voir src/lib/catalogue/product-columns.ts et
-- src/lib/catalogue-admin/repository.ts (déployés AVANT cette migration).
-- Les fonctions security definer (get_price, calculate_product_landed_cost_ht,
-- admin_save_product_full, admin_preview_reprice…) s'exécutent en tant que
-- propriétaire et ne sont pas concernées.
--
-- Toute colonne ajoutée à `products` doit être ajoutée aux DEUX listes
-- (anon et authenticated) : docs/RUNBOOK_SECURITY_GRANTS.md.

revoke select on table public.products from authenticated;

grant select (
  id, sku, category, name, description,
  dim_length_cm, dim_width_cm, dim_height_cm,
  cbm_per_unit, weight_kg, moq_units,
  base_price_ht, retail_price_ref, eco_contribution,
  main_image_url, gallery_urls, features, fire_rating,
  is_active, sort_order, created_at, updated_at,
  table_shape, compatible_top_shapes, visibility
) on table public.products to authenticated;

-- Auto-vérification : la migration échoue (et ne s'enregistre pas) si le
-- résultat n'est pas exactement celui attendu, pour anon ET authenticated.
do $$
declare
  role_name text;
  hidden_col text;
  public_col text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_table_privilege(role_name, 'public.products', 'select') then
      raise exception 'products: % conserve un select table complet', role_name;
    end if;
    foreach hidden_col in array array['fob_usd', 'qty_per_container', 'is_loss_leader', 'table_price_modifier_rate'] loop
      if has_column_privilege(role_name, 'public.products', hidden_col, 'select') then
        raise exception 'products.% reste lisible par %', hidden_col, role_name;
      end if;
    end loop;
    foreach public_col in array array['id', 'sku', 'name', 'base_price_ht', 'is_active', 'visibility'] loop
      if not has_column_privilege(role_name, 'public.products', public_col, 'select') then
        raise exception 'products.% n''est plus lisible par % (catalogue cassé)', public_col, role_name;
      end if;
    end loop;
  end loop;
  -- Les vues publiques restent accordées (security_invoker : elles ne
  -- fonctionnent que si les colonnes ci-dessus sont lisibles).
  if not has_table_privilege('anon', 'public.products_public', 'select')
     or not has_table_privilege('authenticated', 'public.products_public', 'select') then
    raise exception 'products_public : grant select manquant';
  end if;
  -- Les écritures admin (RLS) restent possibles.
  if not has_table_privilege('authenticated', 'public.products', 'insert')
     or not has_table_privilege('authenticated', 'public.products', 'update') then
    raise exception 'products : privilèges d''écriture authenticated perdus';
  end if;
end $$;
