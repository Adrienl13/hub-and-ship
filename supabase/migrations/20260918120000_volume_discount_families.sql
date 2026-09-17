-- 49. Paliers de remise volume PAR FAMILLE de produits.
--
-- Une chaise vaut 82 € en moyenne, un salon de jardin 1 367 €. Avec une grille
-- unique « −6 % dès 100 pièces », le client qui commande dix salons (13 700 €)
-- ne touche rien, tandis que cent chaises (8 200 €) déclenchent la remise. Le
-- volume n'est pas récompensé pour ce qu'il est — un engagement de production —
-- mais pour un nombre de cartons.
--
-- Chaque famille compte donc désormais SES pièces et suit SES paliers :
--   assises = chaises, fauteuils, bancs
--   tables  = tables, plateaux, piètements  (même atelier, commandés ensemble)
--   salons  = salons de jardin et lounges
--   autres  = filet de sécurité pour une catégorie ajoutée plus tard
--
-- RIEN NE CHANGE TANT QUE LA GRILLE N'EST PAS SAISIE. La colonne est nulle par
-- défaut, et tout le monde — le client comme ce RPC — retombe alors très
-- exactement sur le comportement historique : comptage global, grille unique
-- tier2/tier3. Les deux côtés basculent sur la même condition, jamais l'un
-- sans l'autre.
--
-- Plafond de sécurité à 25 % : au-delà, un client direct paierait moins cher
-- qu'un revendeur (73,68 % du prix de base) et la règle d'or du multi-canal
-- serait rompue. Même constante côté client :
-- MAX_VOLUME_DISCOUNT_PERCENT dans src/lib/pricing/discount-families.ts.

-- --------------------------------------------------------------------------
-- 1. Validation de la grille — refusée en bloc si elle est incohérente.
-- --------------------------------------------------------------------------
create or replace function public.volume_discount_families_are_valid(
  p_config jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_family text;
  v_tiers jsonb;
  v_tier jsonb;
  v_units int;
  v_discount numeric;
  v_prev_units int;
  v_prev_discount numeric;
begin
  if p_config is null then
    return true; -- non configuré : régime historique
  end if;
  if jsonb_typeof(p_config) <> 'object' then
    return false;
  end if;

  -- Tout ou rien : une grille à moitié saisie appliquerait une remise à une
  -- famille et pas à l'autre, sans que personne ne s'en aperçoive.
  foreach v_family in array array['assises', 'tables', 'salons', 'autres'] loop
    v_tiers := p_config -> v_family;
    -- `is distinct from` et non `<>` : une famille absente donne NULL, et
    -- `NULL <> 'array'` vaut NULL — la garde ne se déclencherait pas.
    if jsonb_typeof(v_tiers) is distinct from 'array'
      or jsonb_array_length(v_tiers) = 0 then
      return false;
    end if;

    v_prev_units := 0;
    v_prev_discount := 0;
    for v_tier in select value from jsonb_array_elements(v_tiers) loop
      if jsonb_typeof(v_tier) <> 'object' then
        return false;
      end if;
      begin
        v_units := (v_tier ->> 'min_units')::int;
        v_discount := (v_tier ->> 'discount')::numeric;
      exception
        when others then
          return false;
      end;
      if v_units is null or v_discount is null then
        return false;
      end if;
      -- Seuils et remises strictement croissants : un palier plus haut doit
      -- toujours valoir mieux, sinon la grille se contredit.
      if v_units <= v_prev_units or v_discount <= v_prev_discount then
        return false;
      end if;
      if v_discount > 0.25 then
        return false; -- règle d'or : voir en-tête
      end if;
      v_prev_units := v_units;
      v_prev_discount := v_discount;
    end loop;
  end loop;

  return true;
end;
$$;

alter table public.pricing_parameters
  add column if not exists volume_discount_families jsonb;

comment on column public.pricing_parameters.volume_discount_families is
  'Paliers volume par famille (assises/tables/salons/autres). NULL = grille unique historique sur le total des pièces.';

alter table public.pricing_parameters
  drop constraint if exists pricing_parameters_volume_families_valid;
alter table public.pricing_parameters
  add constraint pricing_parameters_volume_families_valid
  check (public.volume_discount_families_are_valid(volume_discount_families));

-- --------------------------------------------------------------------------
-- 2. Famille d'une catégorie. Miroir exact de resolveDiscountFamily().
-- --------------------------------------------------------------------------
create or replace function public.product_discount_family(p_category text)
returns text
language sql
immutable
as $$
  select case p_category
    when 'chair' then 'assises'
    when 'armchair' then 'assises'
    when 'bench' then 'assises'
    when 'table' then 'tables'
    when 'table_base' then 'tables'
    when 'table_top' then 'tables'
    when 'lounge' then 'salons'
    else 'autres'
  end;
$$;

-- --------------------------------------------------------------------------
-- 3. Taux applicable à une ligne. Source unique des deux régimes.
-- --------------------------------------------------------------------------
create or replace function public.volume_discount_rate(
  p_family text,
  p_family_units int,
  p_total_units int,
  p_channel public.sales_channel
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_config jsonb;
  v_tier2_qty int;
  v_tier2 numeric;
  v_tier3_qty int;
  v_tier3 numeric;
  v_tiers jsonb;
  v_tier jsonb;
  v_rate numeric := 0;
begin
  -- Revendeurs et distributeurs ont déjà leur prix canal : jamais de remise
  -- volume par-dessus (même règle que le client, channelAllowsVolumeDiscounts).
  if p_channel is distinct from 'direct'::public.sales_channel then
    return 0;
  end if;

  select p.volume_discount_families, p.tier2_qty, p.tier2_discount,
         p.tier3_qty, p.tier3_discount
    into v_config, v_tier2_qty, v_tier2, v_tier3_qty, v_tier3
  from public.pricing_parameters p
  where p.is_active
  order by p.effective_from desc
  limit 1;

  if v_config is null then
    -- Régime historique : grille unique, sur le nombre TOTAL de pièces.
    if p_total_units >= coalesce(v_tier3_qty, 150) then
      return coalesce(v_tier3, 0.10);
    elsif p_total_units >= coalesce(v_tier2_qty, 100) then
      return coalesce(v_tier2, 0.06);
    end if;
    return 0;
  end if;

  v_tiers := coalesce(v_config -> p_family, v_config -> 'autres');
  if jsonb_typeof(v_tiers) is distinct from 'array' then
    return 0;
  end if;

  for v_tier in select value from jsonb_array_elements(v_tiers) loop
    if p_family_units >= (v_tier ->> 'min_units')::int then
      v_rate := greatest(v_rate, (v_tier ->> 'discount')::numeric);
    end if;
  end loop;

  -- Deuxième filet, indépendant de la contrainte de table : même une grille
  -- écrite directement en SQL ne peut pas franchir la règle d'or.
  return least(v_rate, 0.25);
end;
$$;

revoke all on function public.volume_discount_rate(
  text, int, int, public.sales_channel
) from public;

-- --------------------------------------------------------------------------
-- 4. La grille devient publique — comme les paliers qu'elle remplace, elle
--    est déjà affichée sur /prix et au panier.
-- --------------------------------------------------------------------------
create or replace function public.get_public_pricing_rules()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'tier2_qty', p.tier2_qty,
        'tier2_discount', p.tier2_discount,
        'tier3_qty', p.tier3_qty,
        'tier3_discount', p.tier3_discount,
        'volume_discount_families', p.volume_discount_families,
        'reservation_fee_rate', p.reservation_fee_rate,
        'reservation_fee_min', p.reservation_fee_min,
        'reservation_fee_max', p.reservation_fee_max,
        'distributor_min_order_cbm', p.distributor_min_order_cbm
      )
      from public.pricing_parameters p
      where p.is_active
      order by p.effective_from desc
      limit 1
    ),
    jsonb_build_object(
      'tier2_qty', 100, 'tier2_discount', 0.06,
      'tier3_qty', 150, 'tier3_discount', 0.10,
      'volume_discount_families', null,
      'reservation_fee_rate', 0.03,
      'reservation_fee_min', 150, 'reservation_fee_max', 500,
      'distributor_min_order_cbm', null
    )
  );
$$;

-- --------------------------------------------------------------------------
-- 5. Le RPC de réservation applique un taux PAR LIGNE.
--
-- Substitution ciblée sur la définition vivante (cf. migrations 47 et 48) :
-- les historiques local et distant divergent, réécrire la version du dépôt
-- écraserait ce qui tourne réellement. Idempotent.
-- --------------------------------------------------------------------------
do $mig$
declare
  v_def text;
  v_patched text;

  v_decl_old constant text :=
    '  v_line_subtotals numeric[] := ''{}'';';
  v_decl_new constant text :=
    '  v_line_subtotals numeric[] := ''{}'';'
    || E'\n  -- remise volume par famille (migration 49)'
    || E'\n  v_line_nets numeric[] := ''{}'';'
    || E'\n  v_line_families text[] := ''{}'';'
    || E'\n  v_family_units jsonb := ''{}''::jsonb;'
    || E'\n  v_db_category text;'
    || E'\n  v_family text;'
    || E'\n  v_line_rate numeric;'
    || E'\n  v_idx int;';

  v_select_old constant text :=
    '    select base_price_ht, eco_contribution, cbm_per_unit'
    || E'\n      into v_db_price, v_db_eco, v_db_cbm';
  v_select_new constant text :=
    '    select base_price_ht, eco_contribution, cbm_per_unit, category::text'
    || E'\n      into v_db_price, v_db_eco, v_db_cbm, v_db_category';

  v_accum_old constant text :=
    '    v_line_subtotals := v_line_subtotals || v_line_subtotal;';
  v_accum_new constant text :=
    '    v_line_subtotals := v_line_subtotals || v_line_subtotal;'
    || E'\n    v_family := public.product_discount_family(v_db_category);'
    || E'\n    v_line_families := v_line_families || v_family;'
    || E'\n    v_family_units := jsonb_set(v_family_units, array[v_family],'
    || E'\n      to_jsonb(coalesce((v_family_units ->> v_family)::int, 0) + v_qty), true);';

  v_net_old constant text :=
    '  if v_channel = ''direct'' then'
    || E'\n    if v_units_sum >= coalesce(v_tier3_qty, 150) then'
    || E'\n      v_volume_rate := coalesce(v_tier3, 0.10);'
    || E'\n    elsif v_units_sum >= coalesce(v_tier2_qty, 100) then'
    || E'\n      v_volume_rate := coalesce(v_tier2_discount, 0.06);'
    || E'\n    end if;'
    || E'\n  end if;'
    || E'\n  -- Total HT = somme des lignes remisées, pas un pourcentage du sous-total.'
    || E'\n  v_net_subtotal := 0;'
    || E'\n  foreach v_line_net in array v_line_subtotals loop'
    || E'\n    v_net_subtotal := v_net_subtotal + round(v_line_net * (1 - v_volume_rate), 2);'
    || E'\n  end loop;';
  v_net_new constant text :=
    '  -- Un taux PAR LIGNE : la famille du produit, et le nombre de pièces de'
    || E'\n  -- cette famille dans la commande. volume_discount_rate() retombe sur la'
    || E'\n  -- grille unique historique tant qu''aucune grille famille n''est saisie.'
    || E'\n  v_net_subtotal := 0;'
    || E'\n  for v_idx in 1 .. coalesce(array_length(v_line_subtotals, 1), 0) loop'
    || E'\n    v_line_rate := public.volume_discount_rate('
    || E'\n      v_line_families[v_idx],'
    || E'\n      coalesce((v_family_units ->> v_line_families[v_idx])::int, 0),'
    || E'\n      v_units_sum,'
    || E'\n      v_channel);'
    || E'\n    v_line_net := round(v_line_subtotals[v_idx] * (1 - v_line_rate), 2);'
    || E'\n    v_line_nets := v_line_nets || v_line_net;'
    || E'\n    v_net_subtotal := v_net_subtotal + v_line_net;'
    || E'\n  end loop;';

  v_vat_old constant text :=
    '  v_vat := 0;'
    || E'\n  foreach v_line_net in array v_line_subtotals loop'
    || E'\n    v_vat := v_vat + round(round(v_line_net * (1 - v_volume_rate), 2) * v_vat_rate / 100, 2);'
    || E'\n  end loop;';
  v_vat_new constant text :=
    '  v_vat := 0;'
    || E'\n  foreach v_line_net in array v_line_nets loop'
    || E'\n    v_vat := v_vat + round(v_line_net * v_vat_rate / 100, 2);'
    || E'\n  end loop;';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_reservation_with_items';

  if v_def is null then
    raise exception 'create_reservation_with_items introuvable';
  end if;

  if position('v_line_families' in v_def) > 0 then
    return; -- déjà appliqué
  end if;

  if position('v_line_subtotals' in v_def) = 0 then
    raise exception
      'la migration 48 (somme stricte des lignes) doit être appliquée avant celle-ci';
  end if;

  if position(v_decl_old in v_def) = 0
    or position(v_select_old in v_def) = 0
    or position(v_accum_old in v_def) = 0
    or position(v_net_old in v_def) = 0
    or position(v_vat_old in v_def) = 0 then
    raise exception
      'create_reservation_with_items a changé : points d''ancrage introuvables, corriger cette migration';
  end if;

  v_patched := replace(v_def, v_decl_old, v_decl_new);
  v_patched := replace(v_patched, v_select_old, v_select_new);
  v_patched := replace(v_patched, v_accum_old, v_accum_new);
  v_patched := replace(v_patched, v_net_old, v_net_new);
  v_patched := replace(v_patched, v_vat_old, v_vat_new);

  execute v_patched;
end $mig$;

-- --------------------------------------------------------------------------
-- 6. L'enregistrement des paramètres pricing doit REPORTER la grille.
--
-- admin_save_pricing_parameters() crée une nouvelle version en listant ses
-- colonnes une par une. Sans ce correctif, la première modification d'un
-- paramètre sans rapport (un fret, une marge) remettrait silencieusement la
-- grille à NULL — et toutes les remises repasseraient au comptage global sans
-- que personne ne l'ait demandé.
--
-- Même convention que les frets : champ absent = inchangé, null = effacé.
-- --------------------------------------------------------------------------
do $mig$
declare
  v_def text;
  v_patched text;
  v_cols_old constant text :=
    '    tier2_qty, tier2_discount, tier3_qty, tier3_discount,';
  v_cols_new constant text :=
    '    tier2_qty, tier2_discount, tier3_qty, tier3_discount,'
    || E'\n    volume_discount_families,';
  v_vals_old constant text :=
    '    coalesce((payload ->> ''tier3_discount'')::numeric, v_active.tier3_discount),';
  v_vals_new constant text :=
    '    coalesce((payload ->> ''tier3_discount'')::numeric, v_active.tier3_discount),'
    || E'\n    case when payload ? ''volume_discount_families'''
    || E'\n      then nullif(payload -> ''volume_discount_families'', ''null''::jsonb)'
    || E'\n      else v_active.volume_discount_families end,';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_pricing_parameters';

  if v_def is null then
    raise exception 'admin_save_pricing_parameters introuvable';
  end if;

  if position('volume_discount_families' in v_def) > 0 then
    return; -- déjà appliqué
  end if;

  if position(v_cols_old in v_def) = 0 or position(v_vals_old in v_def) = 0 then
    raise exception
      'admin_save_pricing_parameters a changé : points d''ancrage introuvables';
  end if;

  v_patched := replace(v_def, v_cols_old, v_cols_new);
  v_patched := replace(v_patched, v_vals_old, v_vals_new);

  execute v_patched;
end $mig$;

do $check$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_pricing_parameters';

  if position('volume_discount_families' in v_def) = 0 then
    raise exception
      'admin_save_pricing_parameters ne reporte pas la grille : elle serait perdue à la première sauvegarde';
  end if;
end $check$;

do $check$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_reservation_with_items';

  if position('volume_discount_rate' in v_def) = 0 then
    raise exception 'le RPC n''appelle pas volume_discount_rate';
  end if;
  -- L'ancien taux unique ne doit plus servir nulle part.
  if position('* (1 - v_volume_rate)' in v_def) > 0 then
    raise exception 'un taux de remise unique subsiste dans le calcul';
  end if;
end $check$;
