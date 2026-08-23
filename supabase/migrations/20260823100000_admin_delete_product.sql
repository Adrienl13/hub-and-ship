-- Suppression définitive d'un produit catalogue (admin).
--
-- La désactivation reste le geste par défaut ; la suppression sert à alléger
-- la liste des lignes de test / doublons jamais vendus. Garde-fous :
--   - un produit référencé par des lignes de réservation est IRRÉVERSIBLE
--    côté historique → suppression refusée avec message clair (le FK
--    container_reservation_items.product_id est déjà ON DELETE RESTRICT,
--    on le vérifie explicitement pour renvoyer du français, pas une erreur FK) ;
--   - designs, avis, stock 24h, overrides canaux, coûts pricing suivent en
--     cascade (FK existants) ; product_partner_prices (sans FK) est purgé.

create or replace function public.admin_delete_product(p_product_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_refs integer;
begin
  if not public.is_admin() then
    raise exception 'admin_delete_product: admin only';
  end if;

  if p_product_id is null or btrim(p_product_id) = '' then
    raise exception 'admin_delete_product: product id requis';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'admin_delete_product: produit % introuvable', p_product_id;
  end if;

  select count(*) into v_reservation_refs
  from public.container_reservation_items
  where product_id = p_product_id;

  if v_reservation_refs > 0 then
    raise exception
      'Ce produit est référencé par % ligne(s) de réservation : il fait partie de l''historique commercial. Désactivez-le au lieu de le supprimer.',
      v_reservation_refs;
  end if;

  -- Table sans FK vers products : purge manuelle avant le delete principal.
  delete from public.product_partner_prices where product_id = p_product_id;

  -- Cascade via FK : product_variants (→ stock_lines, seed_commitments),
  -- product_reviews, channel_price_overrides, product_pricing_inputs.
  delete from public.products where id = p_product_id;

  return jsonb_build_object('ok', true, 'deleted_id', p_product_id);
end;
$$;

revoke execute on function public.admin_delete_product(text) from public, anon;
grant execute on function public.admin_delete_product(text) to authenticated;
