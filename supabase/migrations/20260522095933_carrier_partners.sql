-- Carrier partners table for the "Transporteurs partenaires" page.
-- Migrates the previously hardcoded list in src/lib/carriers.ts to a
-- Supabase-managed dataset so the admin can edit it without committing.
-- Public reads are restricted to is_active=true; admin/super_admin own
-- full write access via RLS (matches the pattern used by other admin
-- tables like quality_reports / delivered containers).

do $$
begin
  create type public.carrier_specialty as enum (
    'national','regional_sud_est','regional_ouest','international','plateforme'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.carrier_partners (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  specialty public.carrier_specialty not null,
  specialty_label text not null,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  coverage text not null,
  indicative_pricing text,
  contact_phone text,
  contact_email text,
  contact_website text,
  source text not null default 'partenaire-direct' check (source in ('partenaire-direct','plateforme-publique')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carrier_partners_active_idx on public.carrier_partners (sort_order, is_active);

drop trigger if exists carrier_partners_set_updated_at on public.carrier_partners;
create trigger carrier_partners_set_updated_at before update on public.carrier_partners
  for each row execute function public.set_updated_at();

alter table public.carrier_partners enable row level security;

drop policy if exists "Public reads active carriers" on public.carrier_partners;
create policy "Public reads active carriers" on public.carrier_partners for select
  to anon, authenticated using (is_active = true);

drop policy if exists "Admins full access carriers" on public.carrier_partners;
create policy "Admins full access carriers" on public.carrier_partners for all
  to authenticated
  using (public.current_user_role() in ('admin','super_admin'))
  with check (public.current_user_role() in ('admin','super_admin'));
