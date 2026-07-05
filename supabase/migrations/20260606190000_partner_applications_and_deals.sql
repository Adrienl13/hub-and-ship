-- Partner channel foundation: public applications and protected opportunities.
--
-- Public submissions are intended to go through the same-origin server endpoint
-- `/api/partner-requests`, which uses the service role. RLS stays admin-only for
-- reads/updates so partner pricing and prospect data never leak publicly.

do $$
begin
  create type public.partner_application_status as enum (
    'new',
    'reviewing',
    'qualified',
    'approved',
    'rejected',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.partner_kind as enum (
    'introducer',
    'reseller',
    'agency',
    'installer',
    'network',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.partner_deal_status as enum (
    'submitted',
    'protected',
    'quoted',
    'reserved',
    'won',
    'lost',
    'expired',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partner_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  status public.partner_application_status not null default 'new',
  partner_kind public.partner_kind not null default 'reseller',
  company_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  siret text,
  website text,
  territory text,
  network_description text,
  expected_monthly_volume text,
  message text,
  source text not null default 'partners_page',
  internal_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_applications_status_created
  on public.partner_applications(status, created_at desc);

create index if not exists idx_partner_applications_email_created
  on public.partner_applications(lower(contact_email), created_at desc);

create index if not exists idx_partner_applications_siret_created
  on public.partner_applications(siret, created_at desc)
  where siret is not null;

create table if not exists public.partner_deals (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid references public.partner_applications(id) on delete set null,
  status public.partner_deal_status not null default 'submitted',
  partner_company_name text not null,
  partner_contact_email text not null,
  client_company_name text not null,
  client_siret text,
  client_email text,
  project_city text,
  project_type text not null,
  expected_budget_ht numeric(12, 2),
  expected_purchase_window text,
  product_interest text,
  protection_days int not null default 120 check (protection_days between 30 and 365),
  protected_until timestamptz,
  message text,
  source text not null default 'partners_page',
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_deals_status_created
  on public.partner_deals(status, created_at desc);

create index if not exists idx_partner_deals_partner_email_created
  on public.partner_deals(lower(partner_contact_email), created_at desc);

create index if not exists idx_partner_deals_client_siret
  on public.partner_deals(client_siret)
  where client_siret is not null;

drop trigger if exists partner_applications_set_updated_at
  on public.partner_applications;
create trigger partner_applications_set_updated_at
  before update on public.partner_applications
  for each row execute function public.set_updated_at();

drop trigger if exists partner_deals_set_updated_at on public.partner_deals;
create trigger partner_deals_set_updated_at
  before update on public.partner_deals
  for each row execute function public.set_updated_at();

alter table public.partner_applications enable row level security;
alter table public.partner_deals enable row level security;

drop policy if exists "Admins full access partner applications"
  on public.partner_applications;
create policy "Admins full access partner applications"
  on public.partner_applications for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins full access partner deals"
  on public.partner_deals;
create policy "Admins full access partner deals"
  on public.partner_deals for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
