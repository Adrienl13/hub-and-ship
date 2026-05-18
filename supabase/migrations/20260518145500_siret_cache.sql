-- Cache INSEE/Sirene responses for the verify-siret Edge Function.

create table if not exists public.siret_cache (
  siret text primary key,
  insee_response jsonb not null,
  is_valid boolean not null,
  is_active boolean not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists idx_siret_cache_expires
  on public.siret_cache(expires_at);

alter table public.siret_cache enable row level security;

drop policy if exists "Admins read siret cache" on public.siret_cache;
create policy "Admins read siret cache"
  on public.siret_cache for select
  using (public.current_user_role() in ('admin', 'super_admin'));
