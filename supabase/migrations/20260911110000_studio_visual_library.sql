-- 46. Studio visual library — NON APPLIQUÉE EN PRODUCTION. No product/design seeds.
begin;
create table public.studio_visual_library (
 public_ref text primary key check(public_ref ~ '^PI-[A-Z]{2}-[0-9]{3,6}$'),
 family text not null check(family ~ '^[a-z_]+$'),
 label text not null check(length(label) between 1 and 80),
 thumbnail text not null check(thumbnail ~ '^/studio/materials/pi-[a-z]{2}-[0-9]{3,6}\.webp$'),
 image text not null check(image ~ '^/studio/materials/pi-[a-z]{2}-[0-9]{3,6}-detail\.webp$'),
 tag text not null default '' check(length(tag)<=40), active boolean not null default false,
 color_customization text not null default 'unknown' check(color_customization in ('verified','on_request','unavailable','unknown')),
 color_zones integer check(color_zones between 1 and 8)
);
-- Multiple suppliers can serve one stable public reference. Never projected publicly.
create table public.studio_visual_sources (
 id uuid primary key default extensions.gen_random_uuid(),
 public_ref text not null references public.studio_visual_library(public_ref),
 supplier text not null, factory_ref text, source_asset_uri text not null,
 internal_notes text not null default '', is_active boolean not null default true
);
create table public.studio_visual_associations (
 id uuid primary key default extensions.gen_random_uuid(),
 public_ref text not null references public.studio_visual_library(public_ref),
 product_id text references public.products(id),
 model_family_id text references public.studio_model_families(id),
 palette_refs text[] not null default '{}',
 status text not null default 'unknown' check(status in ('verified','on_request','unavailable','unknown')),
 provenance text not null default '', verified_by uuid references auth.users(id), verified_at timestamptz,
 active boolean not null default true,
 check((product_id is null) <> (model_family_id is null)),
 check((status='unknown' and verified_by is null and verified_at is null) or
 (status<>'unknown' and verified_by is not null and verified_at is not null and length(trim(provenance))>=3))
);
create unique index studio_visual_product_rule on public.studio_visual_associations(public_ref,product_id) where product_id is not null;
create unique index studio_visual_family_rule on public.studio_visual_associations(public_ref,model_family_id) where model_family_id is not null;
create function public.studio_review_visual_association() returns trigger language plpgsql set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin review required' using errcode='42501';end if;
 if exists(select 1 from unnest(new.palette_refs) ref where not exists(select 1 from public.studio_visual_library v where v.public_ref=ref and v.family='palette')) then raise exception 'Unknown public palette' using errcode='23514';end if;
 if new.status='unknown' then new.verified_by:=null;new.verified_at:=null;else new.verified_by:=auth.uid();new.verified_at:=now();end if;
 return new;
end $$;
create trigger studio_visual_association_review before insert or update on public.studio_visual_associations for each row execute function public.studio_review_visual_association();
revoke all on function public.studio_review_visual_association() from public;
-- Future server-side registration. Client hash is an identifier, NEVER proof of approval.
create table public.studio_visual_configurations (
 public_ref text primary key check(public_ref ~ '^PI-C-[0-9A-F]{24}$'),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=200000),
 received_at timestamptz not null default now(), internal_notes text not null default ''
);
alter table public.studio_visual_library enable row level security;
alter table public.studio_visual_sources enable row level security;
alter table public.studio_visual_associations enable row level security;
alter table public.studio_visual_configurations enable row level security;
revoke all on public.studio_visual_library,public.studio_visual_sources,public.studio_visual_associations,public.studio_visual_configurations from public,anon,authenticated;
grant select,insert,update,delete on public.studio_visual_library,public.studio_visual_sources,public.studio_visual_associations to authenticated;
grant select,insert on public.studio_visual_configurations to authenticated;
create policy "Admins manage visual library" on public.studio_visual_library for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage visual sources" on public.studio_visual_sources for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage visual associations" on public.studio_visual_associations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins read configuration dossiers" on public.studio_visual_configurations for select to authenticated using(public.is_admin());
create policy "Admins register configuration dossiers" on public.studio_visual_configurations for insert to authenticated with check(public.is_admin());
create view public.studio_visual_library_public with(security_barrier=true) as
 select public_ref,family,label,thumbnail,image,tag,active,color_customization,color_zones from public.studio_visual_library where active;
create view public.studio_visual_associations_public with(security_barrier=true) as
 select p.id as product_id,a.public_ref,a.status,a.palette_refs from public.studio_visual_associations a
 join public.studio_visual_library v on v.public_ref=a.public_ref and v.active
 join public.products p on p.is_active
 join public.studio_product_profiles sp on sp.product_id=p.id
 where a.active and (a.product_id=p.id or (a.model_family_id=sp.model_family_id and exists(select 1 from public.studio_model_families f where f.id=a.model_family_id and f.status='verified')));
revoke all on public.studio_visual_library_public,public.studio_visual_associations_public from public,anon,authenticated;
grant select on public.studio_visual_library_public,public.studio_visual_associations_public to anon,authenticated;
commit;
