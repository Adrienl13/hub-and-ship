-- 39. Studio Projet — fondation (lot 1). ADDITIF UNIQUEMENT.
--
-- Ce que cette migration fait :
-- - trois tables descriptives studio_* qui QUALIFIENT le catalogue sans
--   toucher à products / product_variants : familles de design (candidates,
--   à vérifier), profil Studio par produit (rôle, sous-type, matière, qualité
--   de données granulaire avec provenance), options de fulfillment déclarées ;
-- - une SURFACE PUBLIQUE MINIMALE (principe du lot 0.5) : les tables studio_*
--   sont INTERNES (aucun grant à anon ; authenticated sous RLS is_admin(),
--   pattern product_pricing_inputs). Le public lit uniquement des vues
--   dédiées à colonnes explicites : studio_product_profiles_public,
--   studio_fulfillment_options_public (booléen is_confirmed, jamais
--   confirmed_by), studio_model_families_public, et studio_products
--   (security_invoker sur products_public + profil public). Aucune note
--   interne, aucun UUID auth.users, aucune colonne de coût, aucune marge ;
--   data_quality est projetée par studio_public_data_quality() qui ne garde
--   que status / source / updatedAt (jamais by, note ni métadonnée future) ;
-- - un peuplement initial IDEMPOTENT et PRUDENT : rôle dérivé de la
--   catégorie, sous-type et matière estimés par heuristique (jamais
--   « verified »), model_family_id JAMAIS renseigné (jamais déduit du nom),
--   aucun style_tags ; le prix public existant est reconnu comme vérité
--   commerciale (source catalogue_public_price) sauf produit sur demande ;
--   une option standard_production « seed_moq » par produit public actif,
--   NON confirmée (confirmed_by null) : elle documente la série standard,
--   elle n'est JAMAIS une disponibilité confirmée.
--
-- Ce qu'elle ne fait pas : aucune suppression, renommage ou modification de
-- colonne existante ; aucune modification de prix, MOQ, stock, panier,
-- réservation ; aucune donnée Studio ne rend un produit public (la vue
-- respecte la RLS de products via products_public).
--
-- ⚠️ À appliquer APRÈS le déploiement du bundle du lot 1 (le code lit les
-- vues avec des colonnes explicites ; l'ancien bundle ne les référence pas,
-- donc l'ordre inverse ne casse rien, mais la règle reste : code puis
-- migration).
--
-- Rollback (aucune donnée existante n'est touchée) :
--   drop view if exists public.studio_products;
--   drop view if exists public.studio_fulfillment_options_public;
--   drop view if exists public.studio_product_profiles_public;
--   drop view if exists public.studio_model_families_public;
--   drop function if exists public.studio_public_data_quality(jsonb);
--   drop table if exists public.studio_fulfillment_options;
--   drop table if exists public.studio_product_profiles;
--   drop table if exists public.studio_model_families;

-- ---------------------------------------------------------------------------
-- 1. Familles de design : candidates (pipeline ou admin) puis vérifiées.
-- ---------------------------------------------------------------------------
create table if not exists public.studio_model_families (
  id text primary key,
  label text not null,
  notes text,
  status text not null default 'candidate'
    check (status in ('candidate', 'verified', 'rejected')),
  source text not null default 'manual'
    check (source in ('manual', 'pipeline')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studio_model_families is
  'Studio : familles de design. Jamais déduites du nom commercial ; status verified uniquement après validation humaine.';

-- ---------------------------------------------------------------------------
-- 2. Profil Studio d'un produit (1:1 products, cascade).
-- ---------------------------------------------------------------------------
create table if not exists public.studio_product_profiles (
  product_id text primary key references public.products (id) on delete cascade,
  studio_role text not null default 'catalog_only'
    check (studio_role in ('seat', 'tabletop', 'base', 'catalog_only')),
  seat_kind text
    check (seat_kind is null or seat_kind in ('chair', 'armchair', 'stool', 'lounger', 'other')),
  material text
    check (material is null or material in ('pe_weave', 'cane', 'rope', 'textilene', 'aluminium', 'hpl', 'metal', 'other')),
  model_family_id text references public.studio_model_families (id) on delete set null,
  -- Traits visuels CALCULÉS (lot 3) : {version, computed_at, ...}. Jamais saisis.
  visual_traits jsonb
    check (visual_traits is null or jsonb_typeof(visual_traits) = 'object'),
  -- Qualité granulaire : {dimensions|weight|material|price|compatibility|
  -- customization|media|model_family: {status, source, updatedAt, by, note}}.
  -- status ∈ verified|estimated|pending ; une source heuristique (sku_prefix,
  -- name_heuristic, family_mode, category, pipeline) n'est jamais verified
  -- (règle appliquée aussi côté code : data-quality.ts).
  data_quality jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data_quality) = 'object'),
  notes text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studio_product_profiles is
  'Studio : qualification descriptive d''un produit (rôle, sous-type, matière, qualité de données). Aucune vérité commerciale ici.';

create index if not exists studio_product_profiles_role_idx
  on public.studio_product_profiles (studio_role);
create index if not exists studio_product_profiles_family_idx
  on public.studio_product_profiles (model_family_id);

-- ---------------------------------------------------------------------------
-- 3. Voies de fulfillment déclarées. Le STOCK n'est pas déclaré ici : il est
--    lu en direct dans stock_lines (une copie deviendrait une disponibilité
--    inventée). manual_review est un résultat de résolution, pas une option.
-- ---------------------------------------------------------------------------
create table if not exists public.studio_fulfillment_options (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  variant_id text references public.product_variants (id) on delete cascade,
  -- Seules des VOIES DE PRODUCTION déclarées vivent ici. `stock` (lu dans
  -- stock_lines) et `manual_review` (résultat de résolution) ne sont pas
  -- des lignes d'options : le type FulfillmentMode du code les porte, la
  -- table non.
  mode text not null
    check (mode in ('standard_production', 'grouped_production')),
  min_quantity integer check (min_quantity is null or min_quantity >= 1),
  max_quantity integer check (max_quantity is null or max_quantity >= 1),
  price_basis text not null default 'container'
    check (price_basis in ('container', 'stock')),
  source text not null default 'admin'
    check (source in ('seed_moq', 'admin')),
  is_active boolean not null default true,
  -- Confirmation ADMIN explicite de la voie. NULL = information de série
  -- (devis, faisabilité), jamais une voie de réservation. Un container
  -- ouvert « global » ne confirme rien : la confirmation est par option.
  -- Jamais exposé au public : la vue publique projette is_confirmed.
  confirmed_by uuid references auth.users (id) on delete set null,
  available_from date,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_fulfillment_options_range_check
    check (max_quantity is null or min_quantity is null or max_quantity >= min_quantity)
);

comment on table public.studio_fulfillment_options is
  'Studio : voies de production déclarées (standard, regroupement). Le stock réel vit dans stock_lines.';

create index if not exists studio_fulfillment_options_product_idx
  on public.studio_fulfillment_options (product_id, is_active);
create unique index if not exists studio_fulfillment_options_seed_idx
  on public.studio_fulfillment_options (product_id, (coalesce(variant_id, '')), mode, source);

-- updated_at (fonction générique existante)
drop trigger if exists studio_model_families_set_updated_at on public.studio_model_families;
create trigger studio_model_families_set_updated_at
  before update on public.studio_model_families
  for each row execute function public.set_updated_at();
drop trigger if exists studio_product_profiles_set_updated_at on public.studio_product_profiles;
create trigger studio_product_profiles_set_updated_at
  before update on public.studio_product_profiles
  for each row execute function public.set_updated_at();
drop trigger if exists studio_fulfillment_options_set_updated_at on public.studio_fulfillment_options;
create trigger studio_fulfillment_options_set_updated_at
  before update on public.studio_fulfillment_options
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Tables studio_* = INTERNES. Aucun grant à anon (toute lecture directe
--    est refusée, colonne par colonne comprise). authenticated reçoit les
--    grants de table mais la SEULE policy est is_admin() : un compte connecté
--    non admin obtient zéro ligne et aucune écriture (pattern
--    product_pricing_inputs, lot 0.5). Le public lit UNIQUEMENT les vues de
--    la section 5.
-- ---------------------------------------------------------------------------
alter table public.studio_model_families enable row level security;
alter table public.studio_product_profiles enable row level security;
alter table public.studio_fulfillment_options enable row level security;

revoke all on table public.studio_model_families from anon, public, authenticated;
revoke all on table public.studio_product_profiles from anon, public, authenticated;
revoke all on table public.studio_fulfillment_options from anon, public, authenticated;

grant select, insert, update, delete on table public.studio_model_families to authenticated;
grant select, insert, update, delete on table public.studio_product_profiles to authenticated;
grant select, insert, update, delete on table public.studio_fulfillment_options to authenticated;

drop policy if exists "Studio families are public" on public.studio_model_families;
drop policy if exists "Admins manage studio families" on public.studio_model_families;
create policy "Admins manage studio families"
  on public.studio_model_families for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Studio profiles are public" on public.studio_product_profiles;
drop policy if exists "Admins manage studio profiles" on public.studio_product_profiles;
create policy "Admins manage studio profiles"
  on public.studio_product_profiles for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Studio fulfillment options are public" on public.studio_fulfillment_options;
drop policy if exists "Admins manage studio fulfillment options" on public.studio_fulfillment_options;
create policy "Admins manage studio fulfillment options"
  on public.studio_fulfillment_options for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Surfaces publiques : vues dédiées à colonnes EXPLICITES.
--
--    Les vues *_public sont volontairement en mode « owner » (pas de
--    security_invoker) : elles lisent les tables internes avec les droits du
--    propriétaire et n'exposent que les colonnes listées, filtrées ; un rôle
--    public n'a AUCUN droit sur les tables sous-jacentes. security_barrier
--    empêche une fonction utilisateur d'être évaluée avant le filtre.
--    Toute nouvelle colonne interne est donc invisible par défaut : il faut
--    l'ajouter explicitement à une vue pour la publier.
--
--    studio_products reste en security_invoker sur products_public (RLS de
--    products : actifs seulement pour anon ; grants colonne par colonne des
--    migrations 37/38) et joint la vue publique des profils.
-- ---------------------------------------------------------------------------

-- Projection publique de data_quality : VRAIE liste blanche SQL.
-- - champs de premier niveau publiables : dimensions, weight, material,
--   price, compatibility, customization, media, model_family — toute autre
--   clé (ex. une vérification interne) disparaît entièrement ;
-- - par champ, uniquement status / source / updatedAt ; `by`, `note` et
--   toute métadonnée future restent internes ;
-- - status et source sont normalisés aux valeurs autorisées (sinon pending /
--   none) et une provenance heuristique n'est jamais publiée `verified`
--   (même règle que src/lib/studio/data-quality.ts).
create or replace function public.studio_public_data_quality(quality jsonb)
returns jsonb
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  with entries as (
    select
      field,
      quality -> field as entry,
      quality -> field ->> 'status' as raw_status,
      quality -> field ->> 'source' as raw_source
    from unnest(array['dimensions', 'weight', 'material', 'price', 'compatibility', 'customization', 'media', 'model_family']) as field
    where jsonb_typeof(quality) = 'object'
      and jsonb_typeof(quality -> field) = 'object'
  ),
  normalized as (
    select
      field,
      case
        when raw_status in ('verified', 'estimated', 'pending') then raw_status
        else 'pending'
      end as status,
      case
        when raw_source in ('admin_input', 'supplier_sheet', 'catalogue_public_price', 'sku_prefix', 'name_heuristic', 'family_mode', 'category', 'pipeline') then raw_source
        else 'none'
      end as source,
      case
        when jsonb_typeof(entry -> 'updatedAt') = 'string' then entry -> 'updatedAt'
        else null
      end as updated_at
    from entries
  )
  select coalesce(
    (
      select jsonb_object_agg(
        field,
        jsonb_strip_nulls(jsonb_build_object(
          'status', case
            when status = 'verified' and source in ('sku_prefix', 'name_heuristic', 'family_mode', 'category', 'pipeline') then 'estimated'
            when status = 'verified' and source = 'none' then 'pending'
            else status
          end,
          'source', source,
          'updatedAt', updated_at
        ))
      )
      from normalized
    ),
    '{}'::jsonb
  );
$$;

comment on function public.studio_public_data_quality(jsonb) is
  'Studio : projection publique de data_quality. Liste blanche de champs, status/source normalisés, uniquement status/source/updatedAt. Jamais by ni note.';

revoke all on function public.studio_public_data_quality(jsonb) from public;
grant execute on function public.studio_public_data_quality(jsonb) to anon, authenticated;

-- 5a. Profils : rôle, sous-type, matière, famille, traits calculés, qualité
--     projetée. Ni notes, ni updated_by. Produits actifs seulement.
--     model_family_id n'est publié que si la famille référencée est
--     VÉRIFIÉE : candidate, rejetée ou absente → null publiquement (la
--     valeur interne de studio_product_profiles n'est pas modifiée).
create or replace view public.studio_product_profiles_public
with (security_barrier = true) as
select
  sp.product_id,
  sp.studio_role,
  sp.seat_kind,
  sp.material,
  case when f.status = 'verified' then sp.model_family_id else null end as model_family_id,
  sp.visual_traits,
  public.studio_public_data_quality(sp.data_quality) as data_quality
from public.studio_product_profiles sp
left join public.studio_model_families f on f.id = sp.model_family_id
where exists (
  select 1 from public.products p where p.id = sp.product_id and p.is_active
);

comment on view public.studio_product_profiles_public is
  'Studio : surface publique des profils (colonnes explicites, data_quality projetée). Table interne : studio_product_profiles.';

-- 5b. Options de fulfillment : is_confirmed (booléen commercial) remplace
--     confirmed_by ; ni note. Options actives de PRODUITS ACTIFS seulement :
--     une donnée Studio ne révèle jamais l'existence opérationnelle d'un
--     produit inactif (les produits on_request sont actifs : inchangés).
create or replace view public.studio_fulfillment_options_public
with (security_barrier = true) as
select
  o.id,
  o.product_id,
  o.variant_id,
  o.mode,
  o.min_quantity,
  o.max_quantity,
  o.price_basis,
  o.source,
  o.is_active,
  (o.confirmed_by is not null) as is_confirmed,
  o.available_from,
  o.expires_at
from public.studio_fulfillment_options o
where o.is_active = true
  and exists (
    select 1 from public.products p where p.id = o.product_id and p.is_active
  );

comment on view public.studio_fulfillment_options_public is
  'Studio : surface publique des voies de fulfillment. is_confirmed = confirmation admin explicite ; confirmed_by reste interne.';

-- 5c. Familles : identifiant et libellé des familles VÉRIFIÉES uniquement.
--     Ni notes, ni created_by, ni candidates en cours de travail.
create or replace view public.studio_model_families_public
with (security_barrier = true) as
select
  f.id,
  f.label,
  f.status
from public.studio_model_families f
where f.status = 'verified';

comment on view public.studio_model_families_public is
  'Studio : familles de design vérifiées (id, label, status). Table interne : studio_model_families.';

revoke all on public.studio_product_profiles_public from public;
revoke all on public.studio_fulfillment_options_public from public;
revoke all on public.studio_model_families_public from public;
grant select on public.studio_product_profiles_public to anon, authenticated;
grant select on public.studio_fulfillment_options_public to anon, authenticated;
grant select on public.studio_model_families_public to anon, authenticated;

-- 5d. studio_products : colonnes publiques EXPLICITES de products_public +
--     profil public. security_invoker : la RLS de products s'applique ; les
--     grants colonne par colonne des migrations 37/38 doivent couvrir chaque
--     colonne listée (docs/RUNBOOK_SECURITY_GRANTS.md).
create or replace view public.studio_products
with (security_invoker = true) as
select
  p.id, p.sku, p.category, p.name, p.description,
  p.dim_length_cm, p.dim_width_cm, p.dim_height_cm,
  p.cbm_per_unit, p.weight_kg, p.moq_units,
  p.base_price_ht, p.retail_price_ref, p.eco_contribution,
  p.main_image_url, p.gallery_urls, p.features, p.fire_rating,
  p.is_active, p.sort_order, p.created_at, p.updated_at,
  p.table_shape, p.compatible_top_shapes, p.visibility,
  coalesce(sp.studio_role, 'catalog_only') as studio_role,
  sp.seat_kind,
  sp.material,
  sp.model_family_id,
  sp.visual_traits,
  coalesce(sp.data_quality, '{}'::jsonb) as data_quality
from public.products_public p
left join public.studio_product_profiles_public sp on sp.product_id = p.id;

comment on view public.studio_products is
  'Studio : catalogue public qualifié. Aucune colonne de coût ni interne (security_invoker sur products_public + studio_product_profiles_public).';

revoke all on public.studio_products from public;
grant select on public.studio_products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Peuplement initial idempotent des profils (on conflict do nothing).
--    Heuristiques = estimated ou pending, jamais verified.
--    model_family_id reste NULL. Aucun style_tags.
-- ---------------------------------------------------------------------------
with family_modes as (
  select
    split_part(sku, '-', 1) as prefix,
    category,
    mode() within group (order by dim_length_cm || 'x' || dim_width_cm || 'x' || dim_height_cm) as dims_mode,
    mode() within group (order by weight_kg) as weight_mode,
    count(*) as members
  from public.products
  group by 1, 2
),
classified as (
  select
    p.id,
    p.sku,
    p.category::text as category,
    p.name,
    p.features,
    p.base_price_ht,
    p.visibility,
    p.main_image_url,
    p.dim_length_cm, p.dim_width_cm, p.dim_height_cm, p.weight_kg,
    fm.dims_mode, fm.weight_mode, fm.members,
    -- Catégories signalées incohérentes par l'audit : hors Studio jusqu'à
    -- correction manuelle (tabourets « chaise haute » inclus).
    (p.sku in ('ROP-031', 'ROP-016', 'TES-031', 'BIS-049', 'TBA-010', 'TES-024', 'TES-043')) as quarantined
  from public.products p
  left join family_modes fm
    on fm.prefix = split_part(p.sku, '-', 1) and fm.category = p.category
)
insert into public.studio_product_profiles
  (product_id, studio_role, seat_kind, material, data_quality, notes)
select
  c.id,
  case
    when c.quarantined then 'catalog_only'
    when c.category in ('chair', 'armchair') then 'seat'
    when c.category = 'table_top' then 'tabletop'
    when c.category = 'table_base' then 'base'
    else 'catalog_only'
  end,
  case
    when c.category not in ('chair', 'armchair') then null
    when c.name ilike '%haute%' then 'stool'
    when c.name ilike '%bain de soleil%' then 'lounger'
    when c.category = 'chair' then 'chair'
    else 'armchair'
  end,
  case
    when c.category in ('chair', 'armchair') then
      case
        when c.sku like 'BIS-%' and (c.name ilike '%cannage%') then 'cane'
        when c.sku like 'BIS-%' then 'pe_weave'
        when c.sku like 'ROP-%' then 'rope'
        when c.sku like 'TES-%' then 'textilene'
        when c.name ilike '%textil%' then 'textilene'
        when c.name ilike '%cordage%' then 'rope'
        when c.name ilike '%cannage%' then 'cane'
        when c.name ilike '%rotin%' or c.name ilike '%tress%' then 'pe_weave'
        else null
      end
    when c.category = 'table_top' then
      case
        when c.name ilike '%HPL%' then 'hpl'
        when c.name ilike '%laqué%' or c.name ilike '%métal%' then 'metal'
        else null
      end
    when c.category = 'table_base' then
      case
        when exists (select 1 from unnest(c.features) f where f ilike '%aluminium%') then 'aluminium'
        when c.name ilike '%fonte%' then 'metal'
        else null
      end
    else null
  end,
  jsonb_build_object(
    'dimensions', jsonb_build_object(
      'status', case
        when c.dim_length_cm <= 0 or c.dim_width_cm <= 0 or c.dim_height_cm <= 0 then 'pending'
        else 'estimated' end,
      'source', case
        when c.dim_length_cm <= 0 or c.dim_width_cm <= 0 or c.dim_height_cm <= 0 then 'none'
        when c.members > 1 and c.dims_mode = (c.dim_length_cm || 'x' || c.dim_width_cm || 'x' || c.dim_height_cm) then 'family_mode'
        else 'admin_input' end,
      'by', 'migration:studio_foundation'),
    'weight', jsonb_build_object(
      'status', case when c.weight_kg <= 0 then 'pending' else 'estimated' end,
      'source', case
        when c.weight_kg <= 0 then 'none'
        when c.members > 1 and c.weight_mode = c.weight_kg then 'family_mode'
        else 'admin_input' end,
      'by', 'migration:studio_foundation'),
    'material', jsonb_build_object(
      'status', case when c.sku like 'BIS-%' or c.sku like 'ROP-%' or c.sku like 'TES-%' or c.name ilike '%textil%' or c.name ilike '%cordage%' or c.name ilike '%cannage%' or c.name ilike '%rotin%' or c.name ilike '%tress%' or c.name ilike '%HPL%' then 'estimated' else 'pending' end,
      'source', case when c.sku like 'BIS-%' or c.sku like 'ROP-%' or c.sku like 'TES-%' then 'sku_prefix'
                     when c.name ilike '%textil%' or c.name ilike '%cordage%' or c.name ilike '%cannage%' or c.name ilike '%rotin%' or c.name ilike '%tress%' or c.name ilike '%HPL%' then 'name_heuristic'
                     else 'none' end,
      'by', 'migration:studio_foundation'),
    'price', jsonb_build_object(
      'status', case when c.base_price_ht > 0 and c.visibility = 'public' then 'verified' else 'pending' end,
      'source', case when c.base_price_ht > 0 and c.visibility = 'public' then 'catalogue_public_price' else 'none' end,
      'by', 'migration:studio_foundation'),
    'compatibility', jsonb_build_object('status', 'pending', 'source', 'none'),
    'customization', jsonb_build_object('status', 'pending', 'source', 'none'),
    'media', jsonb_build_object(
      'status', 'pending',
      'source', case when coalesce(c.main_image_url, '') <> '' then 'admin_input' else 'none' end),
    'model_family', jsonb_build_object('status', 'pending', 'source', 'none')
  ),
  case when c.quarantined
    then 'Catégorie signalée incohérente par l''audit du 07/09/2026 : à corriger avant d''entrer dans le Studio.'
    else null end
from classified c
on conflict (product_id) do nothing;

-- Une option standard_production « seed_moq » par produit public actif, au
-- MOQ existant (aucune nouvelle vérité : c'est le MOQ de la fiche). Elle
-- signifie seulement « nous connaissons la série standard de ce produit » :
-- confirmed_by reste NULL, donc elle sert au devis et à la faisabilité mais
-- n'est JAMAIS une voie de réservation. Seule une confirmation admin
-- explicite (confirmed_by renseigné) ouvre la réservation pour ce produit.
insert into public.studio_fulfillment_options
  (product_id, variant_id, mode, min_quantity, price_basis, source, note)
select p.id, null, 'standard_production', greatest(p.moq_units, 1), 'container', 'seed_moq',
  'Série standard au MOQ de la fiche (peuplement lot 1).'
from public.products p
where p.is_active and p.visibility = 'public'
on conflict (product_id, (coalesce(variant_id, '')), mode, source) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Auto-vérification : la migration échoue si une surface publique expose
--    une colonne de coût ou interne, si anon garde un droit sur une table
--    interne, si un rôle public ne peut plus lire les vues, si la projection
--    de data_quality laisse passer un champ ou une clé hors liste blanche,
--    si une surface publique montre un produit inactif ou une famille non
--    vérifiée, si la table d'options accepte stock/manual_review, si une
--    option semée est confirmée, ou si une famille a été remplie
--    automatiquement. Le bloc ne laisse aucune trace : l'aller-retour de 7f
--    est entièrement défait.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked text;
  missing_profiles integer;
  internal_table text;
  internal_column text;
  public_surface text;
  projected jsonb;
  probe_product text;
begin
  -- 7a. Aucune colonne de coût ni interne dans les surfaces publiques.
  select string_agg(table_name || '.' || column_name, ', ') into leaked
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('studio_products', 'studio_product_profiles_public',
                       'studio_fulfillment_options_public', 'studio_model_families_public')
    and column_name in ('fob_usd', 'qty_per_container', 'is_loss_leader', 'table_price_modifier_rate',
                        'notes', 'note', 'created_by', 'updated_by', 'confirmed_by');
  if leaked is not null then
    raise exception 'surface publique Studio expose une colonne interne : %', leaked;
  end if;

  -- 7b. Les vues publiques sont lisibles par anon et authenticated.
  foreach public_surface in array array['studio_products', 'studio_product_profiles_public',
                                        'studio_fulfillment_options_public', 'studio_model_families_public']
  loop
    if not has_table_privilege('anon', 'public.' || public_surface, 'select')
       or not has_table_privilege('authenticated', 'public.' || public_surface, 'select') then
      raise exception '% : grant select manquant pour anon ou authenticated', public_surface;
    end if;
  end loop;

  -- 7c. anon n'a AUCUN droit sur les tables internes, colonne par colonne
  --     comprise ; personne d'autre que l'admin n'y écrit (RLS is_admin()).
  foreach internal_table in array array['studio_model_families', 'studio_product_profiles',
                                        'studio_fulfillment_options']
  loop
    if has_table_privilege('anon', 'public.' || internal_table, 'select')
       or has_table_privilege('anon', 'public.' || internal_table, 'insert') then
      raise exception '% : anon ne doit avoir aucun droit', internal_table;
    end if;
    foreach internal_column in array array['notes', 'note', 'created_by', 'updated_by', 'confirmed_by', 'data_quality']
    loop
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = internal_table and column_name = internal_column
      ) and has_column_privilege('anon', 'public.' || internal_table, internal_column, 'select') then
        raise exception '%.% : anon ne doit pas pouvoir lire cette colonne', internal_table, internal_column;
      end if;
    end loop;
    if (select count(*) from pg_policies
        where schemaname = 'public' and tablename = internal_table
          and coalesce(qual, '') not like '%is_admin()%') > 0 then
      raise exception '% : seule une policy is_admin() est admise', internal_table;
    end if;
  end loop;

  -- 7d. La projection de data_quality : liste blanche de champs, uniquement
  --     status/source/updatedAt, valeurs normalisées, heuristique jamais
  --     verified.
  projected := public.studio_public_data_quality(
    '{"price": {"status": "verified", "source": "admin_input", "by": "u", "note": "n", "updatedAt": "t"},
      "internal_factory_check": {"status": "verified", "source": "admin_input", "note": "secret"},
      "material": {"status": "verified", "source": "sku_prefix"},
      "weight": {"status": "bizarre", "source": "ailleurs", "updatedAt": 42},
      "media": "pas un objet"}'::jsonb
  );
  if (select array_agg(k order by k) from jsonb_object_keys(projected) k)
     is distinct from array['material', 'price', 'weight'] then
    raise exception 'studio_public_data_quality : champs publiés inattendus : %', projected;
  end if;
  if projected -> 'price' is distinct from
     '{"status": "verified", "source": "admin_input", "updatedAt": "t"}'::jsonb then
    raise exception 'studio_public_data_quality : price mal projeté : %', projected -> 'price';
  end if;
  if projected -> 'material' is distinct from '{"status": "estimated", "source": "sku_prefix"}'::jsonb then
    raise exception 'studio_public_data_quality : une heuristique est publiée verified : %', projected -> 'material';
  end if;
  if projected -> 'weight' is distinct from '{"status": "pending", "source": "none"}'::jsonb then
    raise exception 'studio_public_data_quality : valeurs non normalisées : %', projected -> 'weight';
  end if;
  if public.studio_public_data_quality('"texte"'::jsonb) <> '{}'::jsonb then
    raise exception 'studio_public_data_quality : un JSON non objet doit donner {}';
  end if;

  -- 7e. Les surfaces publiques ne montrent aucun produit inactif.
  if exists (
    select 1 from public.studio_fulfillment_options_public v
    join public.products p on p.id = v.product_id
    where not p.is_active
  ) or exists (
    select 1 from public.studio_product_profiles_public v
    join public.products p on p.id = v.product_id
    where not p.is_active
  ) then
    raise exception 'une surface publique Studio expose un produit inactif';
  end if;

  -- 7f. model_family_id public uniquement pour une famille VÉRIFIÉE.
  --     Contrôle réel de la vue par un aller-retour dans la transaction de
  --     la migration : famille temporaire candidate puis vérifiée, liée à un
  --     produit actif, tout est remis à l'identique avant la fin du bloc.
  select sp.product_id into probe_product
  from public.studio_product_profiles sp
  join public.products p on p.id = sp.product_id
  where p.is_active and sp.model_family_id is null
  limit 1;
  if probe_product is not null then
    insert into public.studio_model_families (id, label, status, source)
      values ('zz-selfcheck-migration-39', 'auto-vérification', 'candidate', 'manual');
    update public.studio_product_profiles
      set model_family_id = 'zz-selfcheck-migration-39' where product_id = probe_product;
    if (select model_family_id from public.studio_product_profiles_public where product_id = probe_product) is not null
       or (select model_family_id from public.studio_products where id = probe_product) is not null then
      raise exception 'une famille candidate est publiée';
    end if;
    update public.studio_model_families set status = 'rejected' where id = 'zz-selfcheck-migration-39';
    if (select model_family_id from public.studio_product_profiles_public where product_id = probe_product) is not null then
      raise exception 'une famille rejetée est publiée';
    end if;
    update public.studio_model_families set status = 'verified' where id = 'zz-selfcheck-migration-39';
    if (select model_family_id from public.studio_product_profiles_public where product_id = probe_product)
       is distinct from 'zz-selfcheck-migration-39'
       or (select model_family_id from public.studio_products where id = probe_product)
       is distinct from 'zz-selfcheck-migration-39' then
      raise exception 'une famille vérifiée n''est pas publiée';
    end if;
    if not exists (select 1 from public.studio_model_families_public where id = 'zz-selfcheck-migration-39')
       or exists (select 1 from public.studio_model_families_public where status <> 'verified') then
      raise exception 'studio_model_families_public : filtre verified incorrect';
    end if;
    update public.studio_product_profiles set model_family_id = null where product_id = probe_product;
    delete from public.studio_model_families where id = 'zz-selfcheck-migration-39';
  end if;

  -- 7g. La table d'options n'accepte que des voies de production.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.studio_fulfillment_options'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%mode%'
      and (pg_get_constraintdef(oid) like '%''stock''%' or pg_get_constraintdef(oid) like '%''manual_review''%')
  ) then
    raise exception 'studio_fulfillment_options.mode ne doit accepter que standard_production et grouped_production';
  end if;

  -- 7h. Peuplement : chaque produit a un profil ; aucune famille auto ;
  --     aucune option semée n'est confirmée.
  select count(*) into missing_profiles
  from public.products p
  where not exists (select 1 from public.studio_product_profiles sp where sp.product_id = p.id);
  if missing_profiles > 0 then
    raise exception '% produit(s) sans profil Studio', missing_profiles;
  end if;

  if exists (select 1 from public.studio_product_profiles where model_family_id is not null) then
    raise exception 'model_family_id ne doit jamais être peuplé automatiquement';
  end if;

  if exists (
    select 1 from public.studio_fulfillment_options
    where source = 'seed_moq' and confirmed_by is not null
  ) then
    raise exception 'une option seed_moq ne doit jamais être confirmée par la migration';
  end if;
end $$;
