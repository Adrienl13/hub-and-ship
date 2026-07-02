-- LOT 3 — Partner applications (candidatures programme partenaires).
--
-- The public /partenaires page lets a pro apply to the partner network. This
-- is a *candidature*, never a self-service sign-up: the sales channel stays an
-- admin-attributed account attribute (decision #2). Anon insert is allowed
-- (write-only, same hardened posture as stock_requests); reads/updates are
-- admin-only. First-touch attribution columns (LOT 2) let us trace which
-- partner link/QR drove the application.

do $$ begin
  create type public.partner_target_status as enum
    ('apporteur', 'revendeur', 'grand_compte', 'distributeur', 'nsp');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.partner_application_status as enum
    ('new', 'in_review', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.partner_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  company_name text not null,
  siret text not null,
  siret_verified boolean not null default false,
  contact_name text not null,
  email text not null,
  phone text,
  activity_profile text not null,          -- brasseur | pisciniste | paysagiste | magasin | chr | agent | export | autre
  target_status public.partner_target_status not null,
  zone text,
  estimated_volume text,
  message text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  partner_ref text,
  status public.partner_application_status not null default 'new',
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_applications_status_created
  on public.partner_applications (status, created_at desc);

create index if not exists idx_partner_applications_profile_created
  on public.partner_applications (activity_profile, created_at desc);

create index if not exists idx_partner_applications_email_created
  on public.partner_applications (lower(email), created_at desc);

create index if not exists partner_applications_partner_ref_idx
  on public.partner_applications (partner_ref)
  where partner_ref is not null;

alter table public.partner_applications enable row level security;

-- Anon can submit a candidature (write-only: no SELECT policy for anon),
-- mirroring the stock_requests hardened pattern. Server-side Zod validation
-- + rate limiting guard the payload; RLS keeps the rows unreadable to anon.
drop policy if exists "Public creates partner applications"
  on public.partner_applications;
create policy "Public creates partner applications"
  on public.partner_applications
  for insert
  with check (true);

-- Admins/super_admins fully manage applications (list, triage, decide).
drop policy if exists "Admins manage partner applications"
  on public.partner_applications;
create policy "Admins manage partner applications"
  on public.partner_applications
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

comment on table public.partner_applications is
  'Partner network applications (candidatures). Anon insert, admin-only read/update. Channel is never granted here — admin attributes it separately (decision #2).';
comment on column public.partner_applications.siret_verified is
  'INSEE verification flag. Anon submissions default false (the authenticated verify-siret edge function cannot run for anon); an admin confirms.';
comment on column public.partner_applications.partner_ref is
  'First-touch partner referral code from ?ref=<CODE> (nullable, LOT 2 attribution).';
