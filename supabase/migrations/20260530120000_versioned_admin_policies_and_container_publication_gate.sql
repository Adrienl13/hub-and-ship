-- Version the admin RLS policies that drifted between repo and DB,
-- and gate `containers.SELECT` on `published_at`.
--
-- Context (audit, 2026-05-30):
-- 1) Policies on containers / products / product_variants /
--    container_seed_commitments and the admin read of professionals lived
--    only in the production DB. A fresh project bootstrap from
--    supabase/migrations/ would enable RLS (the underlying `alter table …
--    enable row level security` is implied by the earlier migrations that
--    create the tables) but ship without any policy, locking the admin UI
--    out of every write.
-- 2) The previous public SELECT on `containers` used `using (true)`,
--    exposing draft containers (published_at IS NULL) — story, gallery,
--    testimonial fields, etc. — to anonymous visitors. Align with the
--    `published_at IS NOT NULL` gate used on `quality_reports`.

-- ---- professionals ---------------------------------------------------------
drop policy if exists "professionals select own" on public.professionals;
create policy "professionals select own"
  on public.professionals for select
  using (id = auth.uid());

drop policy if exists "professionals insert own" on public.professionals;
create policy "professionals insert own"
  on public.professionals for insert
  with check (id = auth.uid());

drop policy if exists "professionals update own" on public.professionals;
create policy "professionals update own"
  on public.professionals for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "admins select all professionals" on public.professionals;
create policy "admins select all professionals"
  on public.professionals for select
  using (public.is_admin());

-- ---- containers ------------------------------------------------------------
drop policy if exists "containers are public" on public.containers;
create policy "containers are public"
  on public.containers for select
  using (published_at is not null);

drop policy if exists "admins write containers" on public.containers;
create policy "admins write containers"
  on public.containers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- products --------------------------------------------------------------
drop policy if exists "products are public" on public.products;
create policy "products are public"
  on public.products for select
  using (is_active);

drop policy if exists "admins write products" on public.products;
create policy "admins write products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- product_variants ------------------------------------------------------
drop policy if exists "variants are public" on public.product_variants;
create policy "variants are public"
  on public.product_variants for select
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_variants.product_id
        and p.is_active
    )
  );

drop policy if exists "admins write variants" on public.product_variants;
create policy "admins write variants"
  on public.product_variants for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- container_seed_commitments --------------------------------------------
drop policy if exists "seed commitments are public" on public.container_seed_commitments;
create policy "seed commitments are public"
  on public.container_seed_commitments for select
  using (true);

drop policy if exists "admins write seed commitments" on public.container_seed_commitments;
create policy "admins write seed commitments"
  on public.container_seed_commitments for all
  using (public.is_admin())
  with check (public.is_admin());
