-- ============================================================
-- Container Club — Rôle admin + seed items containers livrés
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Rôle admin sur professionals
-- ----------------------------------------------------------------
alter table professionals
  add column if not exists is_admin boolean not null default false;

create index if not exists professionals_is_admin_idx
  on professionals (is_admin)
  where is_admin;

-- ----------------------------------------------------------------
-- 2. Helper : current user est admin ?
--    SECURITY DEFINER pour éviter une RLS récursive sur les policies admin.
-- ----------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.professionals where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------
-- 3. RLS : les admins peuvent écrire le catalogue et les containers
-- ----------------------------------------------------------------

-- products : ALL pour admin (écrit + lit même non-actifs)
drop policy if exists "admins write products" on products;
create policy "admins write products"
on products
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- product_variants : ALL pour admin
drop policy if exists "admins write variants" on product_variants;
create policy "admins write variants"
on product_variants
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- containers : ALL pour admin
drop policy if exists "admins write containers" on containers;
create policy "admins write containers"
on containers
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- container_seed_commitments : ALL pour admin
drop policy if exists "admins write seed commitments" on container_seed_commitments;
create policy "admins write seed commitments"
on container_seed_commitments
as permissive
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- container_reservations : admin peut tout voir (pas modifier les vraies résas)
drop policy if exists "admins select all reservations" on container_reservations;
create policy "admins select all reservations"
on container_reservations
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins select all reservation items" on container_reservation_items;
create policy "admins select all reservation items"
on container_reservation_items
for select
to authenticated
using (public.is_admin());

-- professionals : admin peut voir tous les pros (pour back-office)
drop policy if exists "admins select all professionals" on professionals;
create policy "admins select all professionals"
on professionals
for select
to authenticated
using (public.is_admin());

-- ----------------------------------------------------------------
-- 4. Seed des commitments pour les containers livrés (CC-2025-*)
--    Pour que la page détail puisse afficher ce qui était à bord.
-- ----------------------------------------------------------------

-- CC-2025-014 (Marseille, 287 articles, 8 pros) — id ...000000002
insert into container_seed_commitments (container_id, variant_id, units_committed) values
  ('00000000-0000-0000-0000-000000000002', 'v1a', 60),
  ('00000000-0000-0000-0000-000000000002', 'v1c', 50),
  ('00000000-0000-0000-0000-000000000002', 'v2c', 35),
  ('00000000-0000-0000-0000-000000000002', 'v3a', 25),
  ('00000000-0000-0000-0000-000000000002', 'v3c', 20),
  ('00000000-0000-0000-0000-000000000002', 'v4a', 60),
  ('00000000-0000-0000-0000-000000000002', 'v5a', 12),
  ('00000000-0000-0000-0000-000000000002', 'v6a', 25)
on conflict (container_id, variant_id) do nothing;

-- CC-2025-013 (Le Havre, 198 articles, 6 pros) — id ...000000003
insert into container_seed_commitments (container_id, variant_id, units_committed) values
  ('00000000-0000-0000-0000-000000000003', 'v1b', 40),
  ('00000000-0000-0000-0000-000000000003', 'v1d', 22),
  ('00000000-0000-0000-0000-000000000003', 'v2a', 30),
  ('00000000-0000-0000-0000-000000000003', 'v3b', 20),
  ('00000000-0000-0000-0000-000000000003', 'v4b', 50),
  ('00000000-0000-0000-0000-000000000003', 'v4c', 20),
  ('00000000-0000-0000-0000-000000000003', 'v5b', 16)
on conflict (container_id, variant_id) do nothing;

-- CC-2025-012 (Marseille, 412 articles, 11 pros) — id ...000000004
insert into container_seed_commitments (container_id, variant_id, units_committed) values
  ('00000000-0000-0000-0000-000000000004', 'v1a', 80),
  ('00000000-0000-0000-0000-000000000004', 'v1c', 60),
  ('00000000-0000-0000-0000-000000000004', 'v1e', 25),
  ('00000000-0000-0000-0000-000000000004', 'v2b', 40),
  ('00000000-0000-0000-0000-000000000004', 'v3a', 28),
  ('00000000-0000-0000-0000-000000000004', 'v3d', 20),
  ('00000000-0000-0000-0000-000000000004', 'v4a', 75),
  ('00000000-0000-0000-0000-000000000004', 'v4d', 30),
  ('00000000-0000-0000-0000-000000000004', 'v5a', 30),
  ('00000000-0000-0000-0000-000000000004', 'v6c', 24)
on conflict (container_id, variant_id) do nothing;
