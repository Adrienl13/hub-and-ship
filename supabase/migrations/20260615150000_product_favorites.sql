-- Per-user product favourites.
--
-- The frontend already manages favourites directly from the browser. Version the
-- table and its RLS policy here so a fresh Supabase project does not depend on a
-- manually created production table.

create table if not exists public.product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists idx_product_favorites_product
  on public.product_favorites(product_id);

alter table public.product_favorites enable row level security;

drop policy if exists "Users read own favourites" on public.product_favorites;
create policy "Users read own favourites"
  on public.product_favorites for select
  using (user_id = auth.uid());

drop policy if exists "Users add own active favourites" on public.product_favorites;
create policy "Users add own active favourites"
  on public.product_favorites for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.products p
      where p.id = product_favorites.product_id
        and p.is_active
    )
  );

drop policy if exists "Users remove own favourites" on public.product_favorites;
create policy "Users remove own favourites"
  on public.product_favorites for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.product_favorites to authenticated;

comment on table public.product_favorites is
  'Per-user wishlist rows; users can read/add/remove only their own favourites.';
