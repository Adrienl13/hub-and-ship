-- Authenticated partner portal access.
--
-- Links a Supabase auth user to an approved partner application and opens
-- scoped read access so a partner sees ONLY their own application, deals and
-- attributed reservations. A partner never sees another partner's data, and
-- net partner pricing is never stored on these rows so nothing private leaks.
--
-- Linking is self-service and safe: `claim_partner_access()` only links the
-- caller to an application whose `contact_email` equals the caller's verified
-- auth email (and only when that application is qualified/approved). Admins
-- keep full access and can also insert links manually.

create table if not exists public.partner_users (
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_application_id uuid not null
    references public.partner_applications(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'owner')),
  created_at timestamptz not null default now(),
  primary key (user_id, partner_application_id)
);

create index if not exists idx_partner_users_application
  on public.partner_users(partner_application_id);

alter table public.partner_users enable row level security;

-- Application ids the current user is linked to. SECURITY DEFINER so RLS
-- policies can call it without recursive policy evaluation.
create or replace function public.current_partner_application_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select partner_application_id
  from public.partner_users
  where user_id = auth.uid();
$$;

-- Cheap boolean for header/menu gating (mirrors public.is_admin()).
create or replace function public.is_partner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.partner_users where user_id = auth.uid()
  );
$$;

-- Self-service link: attach the caller to every qualified/approved application
-- whose contact email matches the caller's verified auth email. Returns the
-- full set of application ids the caller is linked to afterwards.
create or replace function public.claim_partner_access()
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null or v_email is null then
    return;
  end if;

  insert into public.partner_users (user_id, partner_application_id, role)
  select v_uid, a.id, 'owner'
  from public.partner_applications a
  where lower(a.contact_email) = v_email
    and a.status in (
      'qualified'::public.partner_application_status,
      'approved'::public.partner_application_status
    )
  on conflict (user_id, partner_application_id) do nothing;

  return query
    select partner_application_id
    from public.partner_users
    where user_id = v_uid;
end;
$$;

-- RLS: a user reads their own links; admins manage everything.
drop policy if exists "Partners read own links" on public.partner_users;
create policy "Partners read own links"
  on public.partner_users for select
  using (
    user_id = auth.uid()
    or public.current_user_role() in ('admin', 'super_admin')
  );

drop policy if exists "Admins manage partner links" on public.partner_users;
create policy "Admins manage partner links"
  on public.partner_users for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

-- Partner-scoped reads (additive to the existing admin-only policies).
drop policy if exists "Partners read own application"
  on public.partner_applications;
create policy "Partners read own application"
  on public.partner_applications for select
  using (id in (select public.current_partner_application_ids()));

drop policy if exists "Partners read own deals" on public.partner_deals;
create policy "Partners read own deals"
  on public.partner_deals for select
  using (
    application_id in (select public.current_partner_application_ids())
  );

drop policy if exists "Partners read attributed reservations"
  on public.reservations;
create policy "Partners read attributed reservations"
  on public.reservations for select
  using (
    partner_application_id in (
      select public.current_partner_application_ids()
    )
    or partner_deal_id in (
      select d.id from public.partner_deals d
      where d.application_id in (
        select public.current_partner_application_ids()
      )
    )
  );

-- Helper grants. is_partner mirrors is_admin (callable by anon, returns false
-- when unauthenticated). The id-set helper is referenced inside policies, so
-- both roles need execute to evaluate them. claim_partner_access is only
-- meaningful for an authenticated caller.
revoke execute on function public.current_partner_application_ids() from public;
grant execute on function public.current_partner_application_ids()
  to anon, authenticated;

revoke execute on function public.is_partner() from public;
grant execute on function public.is_partner() to anon, authenticated;

revoke execute on function public.claim_partner_access() from public, anon;
grant execute on function public.claim_partner_access() to authenticated;

comment on table public.partner_users is
  'Links a Supabase auth user to an approved partner application for portal access.';
comment on function public.claim_partner_access() is
  'Self-links the authenticated caller to qualified/approved applications matching their verified email.';
