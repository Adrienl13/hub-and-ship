-- Session 0/Phase 1 foundation: Supabase Auth profiles, companies, security audit.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.user_role as enum ('buyer', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.security_event_type as enum (
    'login_attempt',
    'magic_link_sent',
    'magic_link_rate_limited',
    'siret_lookup_success',
    'siret_lookup_failed',
    'siret_lookup_invalid',
    'siret_lookup_inactive',
    'siret_duplicate_attempt',
    'email_warning_shown',
    'rate_limit_hit',
    'suspicious_pattern',
    'admin_action',
    'data_export',
    'data_deletion',
    'failed_payment_attempt',
    'refund_initiated'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  siret text,
  siren text generated always as (left(siret, 9)) stored,
  vat_number text,
  national_business_id text,
  country_code text not null default 'FR',
  siret_verified boolean not null default false,
  siret_verified_at timestamptz,
  siret_verification_data jsonb,
  naf_code text,
  naf_label text,
  legal_form text,
  legal_form_code text,
  creation_date date,
  is_active_company boolean not null default true,
  inactive_since date,
  risk_flag text not null default 'normal'
    check (risk_flag in ('normal', 'review', 'blocked')),
  risk_notes text,
  billing_email text,
  billing_phone text,
  billing_address jsonb,
  default_delivery_address jsonb,
  default_delivery_postal_code text,
  default_delivery_country text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verification_notes text,
  loyalty_tier int not null default 0,
  total_containers_completed int not null default 0,
  total_lifetime_value numeric(12, 2) not null default 0,
  preferred_locale text not null default 'fr-FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_companies_siret_unique
  on public.companies(siret)
  where siret is not null and risk_flag != 'blocked';

create table if not exists public.users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id),
  first_name text,
  last_name text,
  email text not null,
  phone text,
  role public.user_role not null default 'buyer',
  email_marketing_consent boolean not null default false,
  email_marketing_consent_at timestamptz,
  cgv_accepted_at timestamptz,
  cgv_version_accepted text,
  last_login_at timestamptz,
  preferred_locale text not null default 'fr-FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_profile_company
  on public.users_profile(company_id);

create unique index if not exists idx_users_profile_email_unique
  on public.users_profile(lower(email));

create table if not exists public.security_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type public.security_event_type not null,
  user_id uuid references public.users_profile(id),
  company_id uuid references public.companies(id),
  ip_address inet,
  user_agent text,
  request_id text,
  metadata jsonb,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error', 'critical')),
  reviewed_by uuid references public.users_profile(id),
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_events_type_created
  on public.security_events(event_type, created_at desc);

create index if not exists idx_security_events_ip_created
  on public.security_events(ip_address, created_at desc);

create index if not exists idx_security_events_user
  on public.security_events(user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_security_events_severity
  on public.security_events(severity, created_at desc)
  where severity in ('error', 'critical');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists users_profile_set_updated_at on public.users_profile;
create trigger users_profile_set_updated_at
  before update on public.users_profile
  for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users_profile where id = auth.uid();
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users_profile where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.companies enable row level security;
alter table public.users_profile enable row level security;
alter table public.security_events enable row level security;

drop policy if exists "Users see own company" on public.companies;
create policy "Users see own company"
  on public.companies for select
  using (id = public.current_company_id());

drop policy if exists "Admins full access companies" on public.companies;
create policy "Admins full access companies"
  on public.companies for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Users see own profile" on public.users_profile;
create policy "Users see own profile"
  on public.users_profile for select
  using (id = auth.uid());

drop policy if exists "Users update own profile" on public.users_profile;
create policy "Users update own profile"
  on public.users_profile for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = 'buyer'
    and (
      company_id is null
      or company_id = public.current_company_id()
    )
  );

drop policy if exists "Admins full access profiles" on public.users_profile;
create policy "Admins full access profiles"
  on public.users_profile for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Users insert own security events" on public.security_events;
create policy "Users insert own security events"
  on public.security_events for insert
  with check (
    user_id is null
    or user_id = auth.uid()
  );

drop policy if exists "Admins read security events" on public.security_events;
create policy "Admins read security events"
  on public.security_events for select
  using (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins update security events" on public.security_events;
create policy "Admins update security events"
  on public.security_events for update
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
