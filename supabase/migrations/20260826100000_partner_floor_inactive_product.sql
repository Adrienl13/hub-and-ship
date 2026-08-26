-- 26 — fix : enregistrer un produit INACTIF avec un prix partenaire plantait.
--
-- Symptôme (admin, 26/08/2026) : « Échec de l'enregistrement : get_price:
-- unknown or inactive product bistro-bis-064 » en sauvant une fiche brouillon
-- avec un partner_net_price_ht renseigné.
--
-- Cause : le trigger product_partner_prices_enforce_floor (fonction
-- enforce_product_partner_price_floor, créée en prod hors repo lors du
-- branchement du moteur de prix) remplit formula_price_ht via get_price()
-- quand la colonne arrive vide — or get_price refuse par construction les
-- produits inactifs, et admin_save_product_full insère toujours la ligne
-- sans formula_price_ht.
--
-- Fix : sur un produit inactif on laisse formula_price_ht vide — get_price
-- la calculera au premier reprice après activation. Le plancher de marge,
-- lui, reste vérifié dans tous les cas (calculate_product_landed_cost_ht
-- accepte les produits inactifs) : aucune perte de garde-fou.

create or replace function public.enforce_product_partner_price_floor()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_landed numeric;
  v_params public.pricing_parameters%rowtype;
  v_floor numeric;
  v_product_active boolean;
begin
  if coalesce(new.net_price_ht, 0) <= 0 or not coalesce(new.is_active, true) then
    return new;
  end if;

  v_params := public.active_pricing_parameters(now());
  v_landed := public.calculate_product_landed_cost_ht(new.product_id, now());
  v_floor := round(v_landed * (1 + v_params.min_margin_floor), 2);

  if new.net_price_ht < v_floor then
    raise exception 'product_partner_prices: override % below minimum floor % for product %',
      new.net_price_ht, v_floor, new.product_id;
  end if;

  select p.is_active into v_product_active
  from public.products p
  where p.id = new.product_id;

  -- get_price refuse les produits inactifs : sur une fiche brouillon,
  -- formula_price_ht reste vide et sera rempli au premier reprice après
  -- activation. Ne jamais rappeler get_price ici pour un produit inactif.
  if new.formula_price_ht is null and coalesce(v_product_active, false) then
    new.formula_price_ht := (
      select formula_price_ht
      from public.get_price(
        new.product_id,
        'reseller'::public.pricing_channel,
        1,
        new.partner_application_id,
        now()
      )
    );
  end if;

  new.min_margin_floor := v_params.min_margin_floor;
  new.checked_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  return new;
end;
$$;
