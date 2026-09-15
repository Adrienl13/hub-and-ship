-- Showroom à ciel ouvert. No business seed; private records stay admin-only.
create table public.showroom_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  address text not null default '' check (length(address) <= 500),
  city text not null check (length(city) between 1 and 160),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city_lat double precision not null check (city_lat between -90 and 90),
  city_lng double precision not null check (city_lng between -180 and 180),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  visibility text not null default 'internal' check (visibility in ('internal','public','on_request')),
  publication_agreed boolean not null default false,
  consent_note text not null default '' check (length(consent_note) <= 2000),
  description text not null default '' check (length(description) <= 2000),
  visit_info text not null default '' check (length(visit_info) <= 1000),
  internal_note text not null default '' check (length(internal_note) <= 5000),
  product_skus text[] not null default '{}' check (cardinality(product_skus) <= 100),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showroom_public_requires_agreement check
    (visibility = 'internal' or (publication_agreed and length(trim(consent_note)) > 0)),
  constraint showroom_public_requires_address check
    (visibility <> 'public' or (length(trim(address)) > 0 and latitude is not null and longitude is not null))
);
alter table public.showroom_locations enable row level security;
revoke all on public.showroom_locations from anon, authenticated;
grant select, insert, update, delete on public.showroom_locations to authenticated;
create policy showroom_admin on public.showroom_locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create function public.showroom_validate_location() returns trigger language plpgsql
set search_path = pg_catalog, public as $$
begin
  if exists (select 1 from unnest(new.photo_paths) p where
    p !~ ('^' || new.id::text || '/[a-f0-9-]+[.](webp|jpg|png)$')) then
    raise exception 'Invalid showroom photo path' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger showroom_validate before insert or update on public.showroom_locations
for each row execute function public.showroom_validate_location();

-- Deliberately use an allowlist. Never return the full row to public callers.
create function public.list_public_showroom_locations() returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', case when visibility = 'public' then name else 'Lieu équipé à ' || city end,
    'address', case when visibility = 'public' then address else null end,
    'city', city, 'postal_code', postal_code,
    'latitude', case when visibility = 'public' then latitude else city_lat end,
    'longitude', case when visibility = 'public' then longitude else city_lng end,
    'visibility', visibility, 'description', description, 'visit_info', visit_info,
    'product_skus', product_skus, 'photo_paths', photo_paths
  ) order by city, id), '[]'::jsonb)
  from public.showroom_locations where visibility <> 'internal' and publication_agreed;
$$;
revoke all on function public.list_public_showroom_locations() from public;
grant execute on function public.list_public_showroom_locations() to anon, authenticated;

-- Original photographs stay private. Public access is limited to photographs
-- explicitly attached to a currently published, consented location.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showroom-photos', 'showroom-photos', false, 5242880, array['image/jpeg','image/png','image/webp']);
create function public.showroom_photo_visible(path text) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.showroom_locations
    where visibility <> 'internal' and publication_agreed and path = any(photo_paths));
$$;
revoke all on function public.showroom_photo_visible(text) from public;
grant execute on function public.showroom_photo_visible(text) to anon, authenticated;
create policy showroom_photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'showroom-photos' and (public.is_admin() or public.showroom_photo_visible(name)));
create policy showroom_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'showroom-photos' and public.is_admin());
create policy showroom_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'showroom-photos' and public.is_admin())
  with check (bucket_id = 'showroom-photos' and public.is_admin());
create policy showroom_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'showroom-photos' and public.is_admin());
