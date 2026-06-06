-- Partner share links and link-based reservation attribution.
--
-- `/p/{partner_slug}` captures a safe public slug in contact_snapshot. This
-- migration lets PostgreSQL resolve that slug to an approved partner
-- application or a protected deal before falling back to SIRET/email matching.

alter table public.partner_applications
  add column if not exists partner_referral_slug text;

alter table public.partner_deals
  add column if not exists partner_referral_slug text;

alter table public.reservations
  add column if not exists partner_application_id uuid
    references public.partner_applications(id) on delete set null;

create or replace function public.normalize_partner_slug(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when lower(trim(coalesce($1, ''))) ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
      then lower(trim($1))
    else null
  end;
$$;

alter table public.partner_applications
  drop constraint if exists partner_applications_referral_slug_check;

alter table public.partner_applications
  add constraint partner_applications_referral_slug_check
  check (
    partner_referral_slug is null
    or partner_referral_slug = public.normalize_partner_slug(partner_referral_slug)
  );

alter table public.partner_deals
  drop constraint if exists partner_deals_referral_slug_check;

alter table public.partner_deals
  add constraint partner_deals_referral_slug_check
  check (
    partner_referral_slug is null
    or partner_referral_slug = public.normalize_partner_slug(partner_referral_slug)
  );

alter table public.reservations
  drop constraint if exists reservations_partner_attribution_reason_check;

alter table public.reservations
  add constraint reservations_partner_attribution_reason_check
  check (
    partner_attribution_reason is null
    or partner_attribution_reason in (
      'partner_link',
      'client_siret',
      'client_email',
      'client_email_domain'
    )
  );

create unique index if not exists idx_partner_applications_referral_slug_unique
  on public.partner_applications(lower(partner_referral_slug))
  where partner_referral_slug is not null
    and status in (
      'qualified'::public.partner_application_status,
      'approved'::public.partner_application_status
    );

create index if not exists idx_partner_deals_referral_slug_active
  on public.partner_deals(lower(partner_referral_slug), created_at desc)
  where partner_referral_slug is not null;

create index if not exists idx_reservations_partner_application_created
  on public.reservations(partner_application_id, created_at desc)
  where partner_application_id is not null;

create or replace function public.find_partner_link_attribution(
  p_partner_slug text,
  p_now timestamptz default now()
)
returns table (
  partner_application_id uuid,
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
    select public.normalize_partner_slug(p_partner_slug) as slug
  ),
  deal_matches as (
    select
      d.application_id as partner_application_id,
      d.id as deal_id,
      d.partner_company_name,
      d.partner_contact_email,
      'partner_link'::text as reason,
      public.normalize_partner_slug(d.partner_referral_slug) as matched_value,
      d.protected_until,
      0 as priority,
      d.created_at
    from public.partner_deals d
    cross join normalized_input i
    where i.slug is not null
      and public.normalize_partner_slug(d.partner_referral_slug) = i.slug
      and d.status in (
        'protected'::public.partner_deal_status,
        'quoted'::public.partner_deal_status,
        'reserved'::public.partner_deal_status
      )
      and d.protected_until is not null
      and d.protected_until >= p_now
  ),
  application_matches as (
    select
      a.id as partner_application_id,
      null::uuid as deal_id,
      a.company_name as partner_company_name,
      a.contact_email as partner_contact_email,
      'partner_link'::text as reason,
      public.normalize_partner_slug(a.partner_referral_slug) as matched_value,
      null::timestamptz as protected_until,
      1 as priority,
      a.created_at
    from public.partner_applications a
    cross join normalized_input i
    where i.slug is not null
      and public.normalize_partner_slug(a.partner_referral_slug) = i.slug
      and a.status in (
        'qualified'::public.partner_application_status,
        'approved'::public.partner_application_status
      )
  )
  select
    matches.partner_application_id,
    matches.deal_id,
    matches.partner_company_name,
    matches.partner_contact_email,
    matches.reason,
    matches.matched_value,
    matches.protected_until
  from (
    select * from deal_matches
    union all
    select * from application_matches
  ) matches
  order by matches.priority asc, matches.created_at desc
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
  v_partner_slug text;
  v_link_match record;
  v_match record;
begin
  if new.partner_deal_id is not null
    or new.partner_application_id is not null then
    new.partner_attribution_snapshot :=
      coalesce(new.partner_attribution_snapshot, '{}'::jsonb);
    return new;
  end if;

  if jsonb_typeof(new.contact_snapshot) = 'object' then
    v_contact_email := nullif(new.contact_snapshot ->> 'email', '');
    if jsonb_typeof(new.contact_snapshot -> 'partner_context') = 'object' then
      v_partner_slug :=
        public.normalize_partner_slug(
          new.contact_snapshot -> 'partner_context' ->> 'slug'
        );
    end if;
  end if;

  if v_partner_slug is not null then
    select *
      into v_link_match
    from public.find_partner_link_attribution(v_partner_slug, now())
    limit 1;

    if found then
      new.partner_application_id := v_link_match.partner_application_id;
      new.partner_deal_id := v_link_match.deal_id;
      new.partner_attribution_reason := v_link_match.reason;
      new.partner_attribution_snapshot := jsonb_build_object(
        'partner_company_name', v_link_match.partner_company_name,
        'partner_contact_email', v_link_match.partner_contact_email,
        'matched_value', v_link_match.matched_value,
        'matched_at', now(),
        'protected_until', v_link_match.protected_until,
        'source_path', new.contact_snapshot -> 'partner_context' ->> 'source_path'
      );
      return new;
    end if;
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

revoke execute on function public.find_partner_link_attribution(text, timestamptz)
  from public;
revoke execute on function public.set_reservation_partner_attribution()
  from public;

comment on column public.partner_applications.partner_referral_slug is
  'Safe public slug used by /p/{slug}; does not expose partner net pricing.';
comment on column public.partner_deals.partner_referral_slug is
  'Optional deal-specific share slug used before SIRET/email fallback.';
comment on column public.reservations.partner_application_id is
  'Internal attribution to an approved partner application when a share link is used without a deal-specific match.';
comment on function public.find_partner_link_attribution(text, timestamptz) is
  'Resolves a public partner share slug to an approved partner or protected deal for internal reservation attribution.';
