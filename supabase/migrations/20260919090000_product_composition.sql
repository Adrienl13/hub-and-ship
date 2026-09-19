-- 53. Composition d'un produit : ce qu'on voit vraiment sur la photo.
--
-- Un salon de jardin n'a pas de dimensions. Il a un canapé, deux fauteuils et
-- une table basse, chacun avec les siennes. La fiche annonçait pourtant un
-- unique « L × l × H », qui ne pouvait décrire qu'une pièce sur quatre — et
-- sur ROP-031, tarifée en salon, ce sont restées les dimensions d'une chaise :
-- 52 × 60 × 82 pour un ensemble vendu 1 225 €. L'acheteur voit quatre meubles
-- sur la photo et lit les cotes d'un seul.
--
-- Cette colonne décrit l'ensemble, pièce par pièce :
--   [{"label":"Canapé 3 places","qty":1,"l":180,"w":80,"h":70},
--    {"label":"Fauteuil","qty":2,"l":70,"w":70,"h":70},
--    {"label":"Table basse","qty":1,"l":90,"w":50,"h":40}]
--
-- NULL = produit d'une seule pièce : les colonnes dim_* suffisent, rien ne
-- change. Utilisable par n'importe quelle catégorie — un ensemble table +
-- chaises se décrirait pareil — mais elle est faite pour les salons.
--
-- Elle ne touche ni le prix, ni le MOQ, ni `cbm_per_unit` : le volume
-- conteneur reste la donnée qui fait foi pour le chargement, et il se saisit
-- toujours à part.

create or replace function public.product_composition_is_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_piece jsonb;
  v_qty int;
  v_dim numeric;
  v_key text;
begin
  if p_value is null then
    return true; -- produit d'une seule pièce
  end if;
  if jsonb_typeof(p_value) <> 'array' then
    return false;
  end if;
  -- Une composition vide n'a pas de sens : c'est NULL qu'il faut écrire.
  if jsonb_array_length(p_value) = 0 or jsonb_array_length(p_value) > 20 then
    return false;
  end if;

  for v_piece in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_piece) <> 'object' then
      return false;
    end if;
    if coalesce(trim(v_piece ->> 'label'), '') = ''
      or length(v_piece ->> 'label') > 80 then
      return false;
    end if;

    begin
      v_qty := (v_piece ->> 'qty')::int;
    exception when others then
      return false;
    end;
    if v_qty is null or v_qty < 1 or v_qty > 50 then
      return false;
    end if;

    -- Les trois cotes sont obligatoires et positives : une composition à
    -- moitié saisie rendrait la fiche plus trompeuse que pas de composition
    -- du tout.
    foreach v_key in array array['l', 'w', 'h'] loop
      begin
        v_dim := (v_piece ->> v_key)::numeric;
      exception when others then
        return false;
      end;
      if v_dim is null or v_dim <= 0 or v_dim > 1000 then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

alter table public.products
  add column if not exists composition jsonb;

comment on column public.products.composition is
  'Pièces d''un ensemble (salon, lot) avec leurs cotes propres. NULL = produit d''une seule pièce, les colonnes dim_* font foi.';

alter table public.products
  drop constraint if exists products_composition_valid;
alter table public.products
  add constraint products_composition_valid
  check (public.product_composition_is_valid(composition));

-- La colonne ne sert à rien si elle n'est ni lisible ni écrivable.
--
-- Lisible : `products_public` est la vue du catalogue, et elle est
-- security_invoker — anon lit donc `products` en son nom propre, colonne par
-- colonne (migrations 37 et 38). Sans le grant, le `select` explicite du
-- catalogue échoue sur la colonne manquante, pas seulement sur sa valeur.
grant select (composition) on public.products to anon, authenticated;

create or replace view public.products_public
with (security_invoker = true) as
select
  id, sku, category, name, description,
  dim_length_cm, dim_width_cm, dim_height_cm,
  cbm_per_unit, weight_kg, moq_units,
  base_price_ht, retail_price_ref, eco_contribution,
  main_image_url, gallery_urls, features, fire_rating,
  is_active, sort_order, created_at, updated_at, table_shape,
  compatible_top_shapes, visibility, composition
from public.products;

grant select on public.products_public to anon, authenticated;

-- `studio_products` relaie les colonnes publiques de products au Studio. Elle
-- lit la VUE des profils, jamais la table interne (lot 1).
--
-- DROP puis CREATE, et non `create or replace` : celui-ci ne sait qu'AJOUTER
-- des colonnes à la toute fin de la vue. Or `composition` doit rester parmi
-- les colonnes produit, avant les six colonnes de profil (studio_role,
-- seat_kind…) — sans quoi l'ordre ne correspond plus à
-- PUBLIC_PRODUCT_COLUMNS ++ STUDIO_PROFILE_COLUMNS, la parité que vérifient
-- tests/security/studio-foundation-migration et `bun run security:studio`.
-- Postgres refuse d'ailleurs le remplacement, en le lisant comme un
-- renommage de `studio_role` en `composition`.
--
-- Sans danger : aucune vue, aucune fonction ne dépend de studio_products
-- (vérifié sur pg_depend et pg_proc avant application). Les grants sont
-- reposés juste après, dans la même transaction.
drop view if exists public.studio_products;
create view public.studio_products
with (security_invoker = true) as
select
  p.id, p.sku, p.category, p.name, p.description,
  p.dim_length_cm, p.dim_width_cm, p.dim_height_cm,
  p.cbm_per_unit, p.weight_kg, p.moq_units,
  p.base_price_ht, p.retail_price_ref, p.eco_contribution,
  p.main_image_url, p.gallery_urls, p.features, p.fire_rating,
  p.is_active, p.sort_order, p.created_at, p.updated_at, p.table_shape,
  p.compatible_top_shapes, p.visibility, p.composition,
  coalesce(sp.studio_role, 'catalog_only') as studio_role,
  sp.seat_kind,
  sp.material,
  sp.model_family_id,
  sp.visual_traits,
  coalesce(sp.data_quality, '{}'::jsonb) as data_quality
from public.products_public p
left join public.studio_product_profiles_public sp on sp.product_id = p.id;

revoke all on public.studio_products from public;
grant select on public.studio_products to anon, authenticated;

-- Écrivable : `admin_save_product_full` est le SEUL chemin d'écriture du
-- formulaire produit (une seule RPC transactionnelle). Une colonne qu'elle
-- ignore ne serait jamais enregistrée, et l'admin saisirait une composition
-- qui disparaît au rechargement.
--
-- Substitution ciblée plutôt qu'un `create or replace` repris du dépôt :
-- l'historique local et l'historique distant divergent, réécrire ici la
-- version du dépôt écraserait ce qui tourne réellement. Idempotent.
do $mig$
declare
  v_def text;
  v_patched text;
  -- Une composition absente du payload laisse la valeur en place ; présente
  -- mais pas un tableau (null, ou `[]` refusé par la contrainte), elle
  -- repasse à NULL — c'est ainsi que l'admin RETIRE une composition.
  v_value constant text :=
    'case when jsonb_typeof(v_product -> ''composition'') = ''array'''
    || ' then v_product -> ''composition'' else null end';
  v_cols_old constant text := E'      compatible_top_shapes, visibility\n    )';
  v_cols_new constant text :=
    E'      compatible_top_shapes, visibility, composition\n    )';
  v_vals_old constant text :=
    E'      coalesce(nullif(v_product ->> ''visibility'', ''''), ''public'')\n    );';
  v_vals_new constant text :=
    '      coalesce(nullif(v_product ->> ''visibility'', ''''), ''public''),'
    || E'\n      ' || v_value || E'\n    );';
  v_upd_old constant text :=
    E'      visibility = coalesce(nullif(v_product ->> ''visibility'', ''''), visibility),\n';
  v_upd_new constant text :=
    E'      visibility = coalesce(nullif(v_product ->> ''visibility'', ''''), visibility),\n'
    || '      composition = case when v_product ? ''composition'' then ('
    || v_value || E') else composition end,\n';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_product_full';

  if v_def is null then
    raise exception 'admin_save_product_full introuvable';
  end if;

  if position('composition' in v_def) > 0 then
    return; -- déjà appliqué
  end if;

  -- Les trois ancrages ou aucun : poser l'insert sans l'update donnerait un
  -- formulaire où la composition ne se saisit qu'à la création.
  if position(v_cols_old in v_def) = 0
    or position(v_vals_old in v_def) = 0
    or position(v_upd_old in v_def) = 0 then
    raise exception
      'admin_save_product_full a changé : ancrages introuvables, corriger cette migration';
  end if;

  v_patched := replace(v_def, v_cols_old, v_cols_new);
  v_patched := replace(v_patched, v_vals_old, v_vals_new);
  v_patched := replace(v_patched, v_upd_old, v_upd_new);

  execute v_patched;
end $mig$;

-- Garde-fou : la composition se lit ET s'écrit, sur les deux branches.
do $check$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_save_product_full';

  if position('compatible_top_shapes, visibility, composition' in v_def) = 0 then
    raise exception 'la composition n''est pas insérée à la création';
  end if;
  if position('composition = case when v_product ? ''composition''' in v_def) = 0 then
    raise exception 'la composition n''est pas mise à jour à l''édition';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products_public'
      and column_name = 'composition'
  ) then
    raise exception 'products_public n''expose pas la composition';
  end if;
end $check$;
