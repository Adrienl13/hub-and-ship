-- Partner attribution on reservations.
--
-- A protected reseller opportunity must remain attached to the reseller even
-- if the final buyer later comes back through the public checkout. The public
-- UI must not reveal the partner, but operations need the attribution in admin.

alter table public.reservations
  add column if not exists partner_deal_id uuid
    references public.partner_deals(id) on delete set null,
  add column if not exists partner_attribution_reason text,
  add column if not exists partner_attribution_snapshot jsonb
    not null default '{}'::jsonb;

alter table public.reservations
  drop constraint if exists reservations_partner_attribution_reason_check;

alter table public.reservations
  add constraint reservations_partner_attribution_reason_check
  check (
    partner_attribution_reason is null
    or partner_attribution_reason in (
      'client_siret',
      'client_email',
      'client_email_domain'
    )
  );

create index if not exists idx_reservations_partner_deal_created
  on public.reservations(partner_deal_id, created_at desc)
  where partner_deal_id is not null;

create index if not exists idx_partner_deals_client_email_created
  on public.partner_deals(lower(client_email), created_at desc)
  where client_email is not null;

create or replace function public.normalize_partner_siret(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when length(regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g')) = 14
      then regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g')
    else null
  end;
$$;

create or replace function public.normalize_partner_email(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when lower(trim(coalesce($1, ''))) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      then lower(trim($1))
    else null
  end;
$$;

create or replace function public.email_domain_for_partner_attribution(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(regexp_replace(split_part(public.normalize_partner_email($1), '@', 2), '\.$', ''), '');
$$;

create or replace function public.is_generic_partner_email_domain(value text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(trim(coalesce($1, ''))) = any (array[
    'aol.com',
    'bbox.fr',
    'free.fr',
    'gmail.com',
    'gmx.com',
    'gmx.fr',
    'googlemail.com',
    'hotmail.com',
    'icloud.com',
    'laposte.net',
    'live.com',
    'mac.com',
    'me.com',
    'msn.com',
    'neuf.fr',
    'orange.fr',
    'outlook.com',
    'proton.me',
    'protonmail.com',
    'sfr.fr',
    'wanadoo.fr',
    'yahoo.com',
    'yahoo.fr'
  ]);
$$;

create or replace function public.find_partner_protected_deal(
  p_client_siret text,
  p_client_email text,
  p_now timestamptz default now()
)
returns table (
  deal_id uuid,
  partner_company_name text,
  partner_contact_email text,
  reason text,
  matched_value text,
  protected_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with normalized_input as (
    select
      public.normalize_partner_siret(p_client_siret) as normalized_siret,
      public.normalize_partner_email(p_client_email) as normalized_email,
      public.email_domain_for_partner_attribution(p_client_email) as email_domain
  ),
  active_deals as (
    select
      d.id,
      d.partner_company_name,
      d.partner_contact_email,
      d.protected_until,
      d.created_at,
      public.normalize_partner_siret(d.client_siret) as normalized_client_siret,
      public.normalize_partner_email(d.client_email) as normalized_client_email,
      public.email_domain_for_partner_attribution(d.client_email) as client_email_domain
    from public.partner_deals d
    where d.status in (
      'protected'::public.partner_deal_status,
      'quoted'::public.partner_deal_status,
      'reserved'::public.partner_deal_status
    )
      and d.protected_until is not null
      and d.protected_until >= p_now
  ),
  scored as (
    select
      d.id as deal_id,
      d.partner_company_name,
      d.partner_contact_email,
      case
        when i.normalized_siret is not null
          and d.normalized_client_siret = i.normalized_siret
          then 'client_siret'
        when i.normalized_email is not null
          and d.normalized_client_email = i.normalized_email
          then 'client_email'
        when i.email_domain is not null
          and not public.is_generic_partner_email_domain(i.email_domain)
          and d.client_email_domain = i.email_domain
          and not public.is_generic_partner_email_domain(d.client_email_domain)
          then 'client_email_domain'
        else null
      end as reason,
      case
        when i.normalized_siret is not null
          and d.normalized_client_siret = i.normalized_siret
          then i.normalized_siret
        when i.normalized_email is not null
          and d.normalized_client_email = i.normalized_email
          then i.normalized_email
        when i.email_domain is not null
          and not public.is_generic_partner_email_domain(i.email_domain)
          and d.client_email_domain = i.email_domain
          and not public.is_generic_partner_email_domain(d.client_email_domain)
          then i.email_domain
        else null
      end as matched_value,
      case
        when i.normalized_siret is not null
          and d.normalized_client_siret = i.normalized_siret
          then 1
        when i.normalized_email is not null
          and d.normalized_client_email = i.normalized_email
          then 2
        when i.email_domain is not null
          and not public.is_generic_partner_email_domain(i.email_domain)
          and d.client_email_domain = i.email_domain
          and not public.is_generic_partner_email_domain(d.client_email_domain)
          then 3
        else null
      end as priority,
      d.protected_until,
      d.created_at
    from active_deals d
    cross join normalized_input i
  )
  select
    scored.deal_id,
    scored.partner_company_name,
    scored.partner_contact_email,
    scored.reason,
    scored.matched_value,
    scored.protected_until
  from scored
  where scored.priority is not null
  order by scored.priority asc, scored.created_at desc
  limit 1;
$$;

create or replace function public.set_reservation_partner_attribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact_email text;
  v_match record;
begin
  if new.partner_deal_id is not null then
    new.partner_attribution_snapshot :=
      coalesce(new.partner_attribution_snapshot, '{}'::jsonb);
    return new;
  end if;

  if jsonb_typeof(new.contact_snapshot) = 'object' then
    v_contact_email := nullif(new.contact_snapshot ->> 'email', '');
  end if;

  select *
    into v_match
  from public.find_partner_protected_deal(new.siret, v_contact_email, now())
  limit 1;

  if found then
    new.partner_deal_id := v_match.deal_id;
    new.partner_attribution_reason := v_match.reason;
    new.partner_attribution_snapshot := jsonb_build_object(
      'partner_company_name', v_match.partner_company_name,
      'partner_contact_email', v_match.partner_contact_email,
      'matched_value', v_match.matched_value,
      'matched_at', now(),
      'protected_until', v_match.protected_until
    );
  else
    new.partner_attribution_snapshot :=
      coalesce(new.partner_attribution_snapshot, '{}'::jsonb);
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_set_partner_attribution
  on public.reservations;

create trigger reservations_set_partner_attribution
  before insert or update of siret, contact_snapshot on public.reservations
  for each row execute function public.set_reservation_partner_attribution();

revoke execute on function public.find_partner_protected_deal(text, text, timestamptz)
  from public;
revoke execute on function public.set_reservation_partner_attribution()
  from public;

comment on column public.reservations.partner_deal_id is
  'Internal attribution to a protected partner deal, never shown publicly.';
comment on column public.reservations.partner_attribution_reason is
  'Matching rule used for partner protection: SIRET, exact email or professional email domain.';
comment on function public.find_partner_protected_deal(text, text, timestamptz) is
  'Finds the best active protected partner deal for a buyer SIRET/email without exposing partner data publicly.';
