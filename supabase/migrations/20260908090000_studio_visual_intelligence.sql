-- 41. Studio Lot 3 : données visuelles et moteur V1. NON APPLIQUÉE PROD.
-- Additive : aucun fait commercial modifié, migrations 39/40 inchangées.
begin;

create table public.studio_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  role text not null check (role in ('decision', 'thumb')),
  url text not null check (url ~ '^https://'),
  storage_path text not null check (storage_path like 'studio/%'),
  source_url text not null,
  source_hash text not null,
  quality_score double precision not null check (quality_score between 0 and 1),
  pipeline_version text not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_id),
  unique (product_id, role, pipeline_version, source_hash),
  check (status <> 'validated' or (validated_by is not null and validated_at is not null))
);

create table public.studio_product_visual_features (
  product_id text not null references public.products(id) on delete cascade,
  model_version text not null,
  source_media_id uuid not null,
  embedding double precision[] not null check (cardinality(embedding) = 384 and array_position(embedding,null) is null and 1 >= all(embedding) and -1 <= all(embedding)),
  features jsonb not null check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  primary key (product_id, model_version),
  foreign key (source_media_id, product_id) references public.studio_product_media(id, product_id) on delete cascade
);

create table public.studio_product_neighbors (
  product_id text not null,
  neighbor_product_id text not null,
  model_version text not null,
  rank integer not null check (rank between 1 and 12),
  similarity double precision not null check (similarity between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (product_id, neighbor_product_id, model_version),
  unique (product_id, model_version, rank),
  check (product_id <> neighbor_product_id),
  foreign key (product_id, model_version) references public.studio_product_visual_features(product_id, model_version) on delete cascade,
  foreign key (neighbor_product_id, model_version) references public.studio_product_visual_features(product_id, model_version) on delete cascade
);

create table public.studio_model_family_candidates (
  id uuid primary key default gen_random_uuid(),
  product_a_id text not null references public.products(id) on delete cascade,
  product_b_id text not null references public.products(id) on delete cascade,
  model_version text not null,
  similarity double precision not null check (similarity between 0 and 1),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  status text not null default 'candidate' check (status in ('candidate', 'accepted', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  family_id text references public.studio_model_families(id),
  created_at timestamptz not null default now(),
  check (product_a_id < product_b_id),
  unique (product_a_id, product_b_id, model_version)
);

create table public.studio_algorithm_versions (
  version text primary key check (version ~ '^v[0-9]+\.[0-9]+$'),
  engine text not null check (engine in ('v0', 'v1')),
  model_version text,
  status text not null check (status in ('preview', 'active', 'disabled')),
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (not is_default or status = 'active')
);
create unique index studio_algorithm_one_default on public.studio_algorithm_versions(is_default) where is_default;
insert into public.studio_algorithm_versions(version, engine, model_version, status, is_default) values
 ('v0.1', 'v0', null, 'active', true),
 ('v1.0', 'v1', 'dinov2-small:ed25f3a31f01632728cabb09d1542f84ab7b0056:cls-l2-v1', 'preview', false);

-- File de relance offline : aucune inférence ML dans le Worker.
create table public.studio_visual_jobs (
 id uuid primary key default gen_random_uuid(),
 product_id text not null references public.products(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','done','error')),
 error text,
 requested_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);

alter table public.studio_diagnostic_pairs add column pipeline_version text;
-- Élargissement explicite de la contrainte existante, toutes les valeurs Lot 2 conservées.
alter table public.studio_events drop constraint studio_events_event_type_check;
alter table public.studio_events add constraint studio_events_event_type_check check (event_type in (
 'studio_started','card_liked','card_disliked','card_passed','undo',
 'favorite_added','favorite_removed','finalists_viewed','seat_selected','quantity_changed','project_completed',
 'convergence_ready','convergence_stalled','convergence_prompt_viewed','convergence_accepted','exploration_continued'
));

alter table public.studio_product_media enable row level security;
revoke all on table public.studio_product_media from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_product_media to authenticated;
grant all on table public.studio_product_media to service_role;
create policy "Admins manage studio_product_media" on public.studio_product_media for all
 using (public.is_admin()) with check (public.is_admin());
alter table public.studio_product_visual_features enable row level security;
revoke all on table public.studio_product_visual_features from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_product_visual_features to authenticated;
grant all on table public.studio_product_visual_features to service_role;
create policy "Admins manage studio_product_visual_features" on public.studio_product_visual_features for all
 using (public.is_admin()) with check (public.is_admin());
alter table public.studio_product_neighbors enable row level security;
revoke all on table public.studio_product_neighbors from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_product_neighbors to authenticated;
grant all on table public.studio_product_neighbors to service_role;
create policy "Admins manage studio_product_neighbors" on public.studio_product_neighbors for all
 using (public.is_admin()) with check (public.is_admin());
alter table public.studio_model_family_candidates enable row level security;
revoke all on table public.studio_model_family_candidates from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_model_family_candidates to authenticated;
grant all on table public.studio_model_family_candidates to service_role;
create policy "Admins manage studio_model_family_candidates" on public.studio_model_family_candidates for all
 using (public.is_admin()) with check (public.is_admin());
alter table public.studio_algorithm_versions enable row level security;
revoke all on table public.studio_algorithm_versions from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_algorithm_versions to authenticated;
grant all on table public.studio_algorithm_versions to service_role;
create policy "Admins manage studio_algorithm_versions" on public.studio_algorithm_versions for all
 using (public.is_admin()) with check (public.is_admin());
alter table public.studio_visual_jobs enable row level security;
revoke all on table public.studio_visual_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.studio_visual_jobs to authenticated;
grant all on table public.studio_visual_jobs to service_role;
create policy "Admins manage studio_visual_jobs" on public.studio_visual_jobs for all
 using (public.is_admin()) with check (public.is_admin());

-- Projection bornée des traits : les métadonnées et JSON internes ne sortent pas.
create function public.studio_public_visual_traits(traits jsonb) returns jsonb
language sql immutable strict set search_path = '' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
 from jsonb_each(traits) where key in ('silhouette_ratio','edge_density','global_contrast','pattern_score','openness')
 and case when jsonb_typeof(value) = 'number' then (value::text)::numeric between 0 and 100 else false end;
$$;
revoke all on function public.studio_public_visual_traits(jsonb) from public;
grant execute on function public.studio_public_visual_traits(jsonb) to anon, authenticated;
create or replace view public.studio_product_profiles_public
with (security_barrier = true) as
select
  sp.product_id,
  sp.studio_role,
  sp.seat_kind,
  sp.material,
  case when f.status = 'verified' then sp.model_family_id else null end as model_family_id,
  case when exists (select 1 from public.studio_product_media m where m.product_id = sp.product_id and m.role = 'decision' and m.status = 'validated' and m.source_hash = sp.visual_traits ->> 'source_hash' and m.pipeline_version = sp.visual_traits ->> 'version' and m.id = (select latest.id from public.studio_product_media latest where latest.product_id = sp.product_id and latest.role = 'decision' and latest.status = 'validated' order by latest.validated_at desc, latest.id limit 1)) then public.studio_public_visual_traits(sp.visual_traits) else null end as visual_traits,
  public.studio_public_data_quality(sp.data_quality) as data_quality
from public.studio_product_profiles sp
left join public.studio_model_families f on f.id = sp.model_family_id
where exists (
  select 1 from public.products p where p.id = sp.product_id and p.is_active
);


-- Une seule image par rôle/produit : dernière validation. Aucune identité admin.
create view public.studio_product_media_public with (security_barrier = true) as
select distinct on (m.product_id, m.role) m.product_id, m.role, m.url
from public.studio_product_media m
join public.products p on p.id = m.product_id and p.is_active
where m.status = 'validated'
order by m.product_id, m.role, m.validated_at desc, m.id;

create view public.studio_product_neighbors_public with (security_barrier = true) as
select n.product_id, n.neighbor_product_id, n.rank, n.similarity, n.model_version
from public.studio_product_neighbors n
join public.products a on a.id = n.product_id and a.is_active
join public.products b on b.id = n.neighbor_product_id and b.is_active
join public.studio_product_visual_features fa on fa.product_id = n.product_id and fa.model_version = n.model_version
join public.studio_product_visual_features fb on fb.product_id = n.neighbor_product_id and fb.model_version = n.model_version
join public.studio_product_media ma on ma.id = fa.source_media_id and ma.status = 'validated' and ma.role = 'decision'
join public.studio_product_media mb on mb.id = fb.source_media_id and mb.status = 'validated' and mb.role = 'decision'
join public.studio_product_media_public current_a on current_a.product_id = n.product_id and current_a.role = 'decision' and current_a.url = ma.url
join public.studio_product_media_public current_b on current_b.product_id = n.neighbor_product_id and current_b.role = 'decision' and current_b.url = mb.url;

create view public.studio_algorithm_versions_public with (security_barrier = true) as
select v.version, v.engine, v.model_version, v.status
from public.studio_algorithm_versions v
where v.status in ('preview', 'active');
revoke all on public.studio_product_media_public from public;
grant select on public.studio_product_media_public to anon, authenticated;
revoke all on public.studio_product_neighbors_public from public;
grant select on public.studio_product_neighbors_public to anon, authenticated;
revoke all on public.studio_algorithm_versions_public from public;
grant select on public.studio_algorithm_versions_public to anon, authenticated;

-- Validation humaine atomique ; seul l'admin peut accepter et relier une famille.
create function public.studio_review_family(candidate_id uuid, accept boolean, family_label text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.studio_model_family_candidates; f text;
begin
 if not public.is_admin() then raise exception 'Forbidden' using errcode = '42501'; end if;
 select * into strict c from public.studio_model_family_candidates where id = candidate_id for update;
 if c.status <> 'candidate' then raise exception 'Already reviewed'; end if;
 if accept then
   if length(trim(coalesce(family_label,''))) not between 1 and 120 then raise exception 'Family label required'; end if;
   perform 1 from public.studio_product_profiles where product_id in (c.product_a_id,c.product_b_id) order by product_id for update;
   if (select count(*) from public.studio_product_profiles sp join public.products p on p.id = sp.product_id and p.is_active where sp.product_id in (c.product_a_id,c.product_b_id)) <> 2 then raise exception 'Two active profiles required'; end if;
   if exists (select 1 from public.studio_product_profiles where product_id in (c.product_a_id,c.product_b_id) and model_family_id is not null) then
     raise exception 'Existing family: review manually';
   end if;
   f := 'studio-' || c.id::text;
   insert into public.studio_model_families(id,label,status,source) values (f,trim(family_label),'verified','manual');
   update public.studio_product_profiles set model_family_id = f where product_id in (c.product_a_id,c.product_b_id);
 end if;
 update public.studio_model_family_candidates set status = case when accept then 'accepted' else 'rejected' end,
 reviewed_by = auth.uid(), reviewed_at = now(), family_id = f where id = candidate_id;
end $$;
revoke all on function public.studio_review_family(uuid,boolean,text) from public, anon;
grant execute on function public.studio_review_family(uuid,boolean,text) to authenticated;

-- Une session ne change jamais de version à cause d'un lot d'événements tardif.
create function public.studio_keep_session_version() returns trigger language plpgsql as $$
begin
 if new.algorithm_version <> old.algorithm_version then raise exception 'Studio session version is immutable'; end if;
 return new;
end $$;
create trigger studio_session_version_immutable before update on public.studio_sessions
 for each row execute function public.studio_keep_session_version();
commit;
