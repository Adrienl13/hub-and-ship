-- 40. Studio Projet — lot 2 : sessions, événements, jeux curés, paires
--     diagnostiques. ADDITIF UNIQUEMENT.
--
-- Ce que cette migration fait :
-- - studio_sessions / studio_events : mesure des interactions de découverte.
--   Écriture UNIQUEMENT côté serveur (service_role, POST /api/studio/events).
--   Aucun grant à anon ; authenticated ne lit qu'en admin (RLS is_admin()).
--   Aucune PII : identifiant de session anonyme, produit, action, version
--   d'algorithme, payload minimal validé côté API.
-- - studio_curation_sets : INFRASTRUCTURE du jeu pilote (product_ids
--   explicites, critères traçables). Aucun jeu n'est inséré : la curation
--   qualitative dépend des métriques objectives du lot 3. Surface publique
--   minimale (jeux actifs : id, label, product_ids) pour `?set=pilot`.
-- - studio_diagnostic_pairs : paires diagnostiques EXPLICITES pour de futurs
--   duels. Table VIDE par défaut, jamais de paire générée au seed. Surface
--   publique minimale (paires vérifiées de produits actifs).
--
-- Ce qu'elle ne fait pas : aucune modification de table existante, aucun
-- prix, MOQ, stock, panier, réservation ; aucun étiquetage de style.
--
-- ⚠️ NON APPLIQUÉE EN PRODUCTION à la livraison du lot 2. Ordre : code puis
-- migration (le code dégrade proprement si les surfaces manquent).
--
-- Rollback (aucune donnée existante n'est touchée) :
--   drop view if exists public.studio_diagnostic_pairs_public;
--   drop view if exists public.studio_curation_sets_public;
--   drop table if exists public.studio_events;
--   drop table if exists public.studio_sessions;
--   drop table if exists public.studio_diagnostic_pairs;
--   drop table if exists public.studio_curation_sets;

-- ---------------------------------------------------------------------------
-- 1. Sessions anonymes de découverte.
-- ---------------------------------------------------------------------------
create table if not exists public.studio_sessions (
  id text primary key
    check (id ~ '^[A-Za-z0-9-]{8,64}$'),
  algorithm_version text not null
    check (algorithm_version ~ '^v[0-9]+\.[0-9]+$'),
  entry text
    check (entry is null or entry in ('full_project', 'seats', 'tables')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.studio_sessions is
  'Studio : session anonyme de découverte (aucune PII). Écrite par le serveur uniquement.';

-- ---------------------------------------------------------------------------
-- 2. Événements : un par interaction, event_type strictement contraint.
-- ---------------------------------------------------------------------------
create table if not exists public.studio_events (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id text not null references public.studio_sessions (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'studio_started', 'card_liked', 'card_disliked', 'card_passed', 'undo',
      'favorite_added', 'favorite_removed', 'finalists_viewed', 'seat_selected',
      'quantity_changed', 'project_completed'
    )),
  product_id text references public.products (id) on delete set null,
  variant_id text,
  algorithm_version text not null
    check (algorithm_version ~ '^v[0-9]+\.[0-9]+$'),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2048),
  client_ts timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.studio_events is
  'Studio : interactions de découverte (session anonyme, produit, action, version d''algorithme). Écrites par le serveur uniquement.';

create index if not exists studio_events_session_idx
  on public.studio_events (session_id, created_at);
create index if not exists studio_events_product_idx
  on public.studio_events (product_id) where product_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Jeux curés (infrastructure). product_ids explicites, critères traçables.
--    Aucun jeu inséré par cette migration.
-- ---------------------------------------------------------------------------
create table if not exists public.studio_curation_sets (
  id text primary key
    check (id ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  label text not null,
  product_ids text[] not null default '{}',
  -- Critères objectifs utilisés (métriques d'image, diversité, structure) :
  -- {version, method, filters[], computed_at}. Jamais une étiquette de style.
  criteria jsonb not null default '{}'::jsonb
    check (jsonb_typeof(criteria) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.studio_curation_sets is
  'Studio : jeux curés (pilote). product_ids explicites et critères objectifs traçables ; aucun étiquetage manuel de style.';

drop trigger if exists studio_curation_sets_set_updated_at on public.studio_curation_sets;
create trigger studio_curation_sets_set_updated_at
  before update on public.studio_curation_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Paires diagnostiques explicites. VIDE par défaut.
-- ---------------------------------------------------------------------------
create table if not exists public.studio_diagnostic_pairs (
  id uuid primary key default extensions.gen_random_uuid(),
  product_a_id text not null references public.products (id) on delete cascade,
  product_b_id text not null references public.products (id) on delete cascade,
  -- Axe MESURÉ (trait visuel calculé ou embedding), jamais subjectif.
  axis text not null check (length(axis) between 2 and 40),
  source text not null default 'manual'
    check (source in ('manual', 'pipeline')),
  status text not null default 'candidate'
    check (status in ('candidate', 'verified', 'rejected')),
  notes text,
  verified_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint studio_diagnostic_pairs_distinct_check check (product_a_id <> product_b_id)
);

comment on table public.studio_diagnostic_pairs is
  'Studio : paires diagnostiques explicites (admin ou pipeline), utilisées pour un duel seulement si vérifiées. Vide par défaut.';

create unique index if not exists studio_diagnostic_pairs_unique_idx
  on public.studio_diagnostic_pairs (least(product_a_id, product_b_id), greatest(product_a_id, product_b_id), axis);

-- ---------------------------------------------------------------------------
-- 5. RLS et grants : tables INTERNES. Aucun grant à anon. authenticated sous
--    la seule policy is_admin(). Le serveur (service_role) contourne la RLS
--    pour écrire sessions et événements.
-- ---------------------------------------------------------------------------
alter table public.studio_sessions enable row level security;
alter table public.studio_events enable row level security;
alter table public.studio_curation_sets enable row level security;
alter table public.studio_diagnostic_pairs enable row level security;

revoke all on table public.studio_sessions from anon, public, authenticated;
revoke all on table public.studio_events from anon, public, authenticated;
revoke all on table public.studio_curation_sets from anon, public, authenticated;
revoke all on table public.studio_diagnostic_pairs from anon, public, authenticated;

-- Sessions et événements : lecture admin seulement, aucune écriture client.
grant select on table public.studio_sessions to authenticated;
grant select on table public.studio_events to authenticated;
-- Curation et paires : gestion admin (lecture + écriture) via RLS.
grant select, insert, update, delete on table public.studio_curation_sets to authenticated;
grant select, insert, update, delete on table public.studio_diagnostic_pairs to authenticated;

drop policy if exists "Admins read studio sessions" on public.studio_sessions;
create policy "Admins read studio sessions"
  on public.studio_sessions for select
  using (public.is_admin());

drop policy if exists "Admins read studio events" on public.studio_events;
create policy "Admins read studio events"
  on public.studio_events for select
  using (public.is_admin());

drop policy if exists "Admins manage studio curation sets" on public.studio_curation_sets;
create policy "Admins manage studio curation sets"
  on public.studio_curation_sets for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage studio diagnostic pairs" on public.studio_diagnostic_pairs;
create policy "Admins manage studio diagnostic pairs"
  on public.studio_diagnostic_pairs for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Surfaces publiques minimales (mode propriétaire + security_barrier,
--    pattern lot 1). Jamais notes, created_by, verified_by, criteria.
-- ---------------------------------------------------------------------------
create or replace view public.studio_curation_sets_public
with (security_barrier = true) as
select
  s.id,
  s.label,
  s.product_ids
from public.studio_curation_sets s
where s.status = 'active';

comment on view public.studio_curation_sets_public is
  'Studio : jeux curés actifs (id, label, product_ids). Table interne : studio_curation_sets.';

create or replace view public.studio_diagnostic_pairs_public
with (security_barrier = true) as
select
  d.id,
  d.product_a_id,
  d.product_b_id,
  d.axis
from public.studio_diagnostic_pairs d
where d.status = 'verified'
  and exists (select 1 from public.products a where a.id = d.product_a_id and a.is_active)
  and exists (select 1 from public.products b where b.id = d.product_b_id and b.is_active);

comment on view public.studio_diagnostic_pairs_public is
  'Studio : paires diagnostiques vérifiées entre produits actifs. Table interne : studio_diagnostic_pairs.';

revoke all on public.studio_curation_sets_public from public;
revoke all on public.studio_diagnostic_pairs_public from public;
grant select on public.studio_curation_sets_public to anon, authenticated;
grant select on public.studio_diagnostic_pairs_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Auto-vérification.
-- ---------------------------------------------------------------------------
do $$
declare
  internal_table text;
  leaked text;
begin
  foreach internal_table in array array['studio_sessions', 'studio_events', 'studio_curation_sets', 'studio_diagnostic_pairs']
  loop
    if has_table_privilege('anon', 'public.' || internal_table, 'select')
       or has_table_privilege('anon', 'public.' || internal_table, 'insert') then
      raise exception '% : anon ne doit avoir aucun droit', internal_table;
    end if;
    if (select count(*) from pg_policies
        where schemaname = 'public' and tablename = internal_table
          and coalesce(qual, '') not like '%is_admin()%') > 0 then
      raise exception '% : seule une policy is_admin() est admise', internal_table;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.studio_events', 'insert')
     or has_table_privilege('authenticated', 'public.studio_sessions', 'insert') then
    raise exception 'studio_events / studio_sessions : aucune écriture client';
  end if;

  select string_agg(table_name || '.' || column_name, ', ') into leaked
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('studio_curation_sets_public', 'studio_diagnostic_pairs_public')
    and column_name in ('notes', 'criteria', 'created_by', 'verified_by', 'status', 'source');
  if leaked is not null then
    raise exception 'surface publique Studio expose une colonne interne : %', leaked;
  end if;

  if not has_table_privilege('anon', 'public.studio_curation_sets_public', 'select')
     or not has_table_privilege('anon', 'public.studio_diagnostic_pairs_public', 'select') then
    raise exception 'surfaces publiques du lot 2 illisibles par anon';
  end if;

  if exists (select 1 from public.studio_diagnostic_pairs) then
    raise exception 'studio_diagnostic_pairs doit être vide à la migration';
  end if;
  if exists (select 1 from public.studio_curation_sets) then
    raise exception 'studio_curation_sets doit être vide à la migration (aucun jeu inventé)';
  end if;
end $$;
