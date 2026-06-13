-- Real referral program (commercial track, 2026-06-13).
--
-- Replaces the hardcoded MOCK_REFERRAL_CODES with a real, per-customer system.
-- Double-sided: the referred customer gets -100 EUR on their reservation fee
-- (capped at the fee), the referrer accrues a 100 EUR credit honoured manually
-- by an admin. The discount is validated and applied SERVER-SIDE inside
-- create_reservation_with_items (the client can no longer fake a referral
-- discount), and each successful redemption is recorded atomically.

-- ---- Tables ----------------------------------------------------------------
create table if not exists public.referral_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  owner_user_id uuid not null,
  owner_email text,
  owner_siret text,
  owner_label text,
  is_active boolean not null default true,
  max_uses int not null default 100,
  total_uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_referral_codes_owner
  on public.referral_codes (owner_user_id);

create table if not exists public.referral_redemptions (
  id uuid primary key default extensions.gen_random_uuid(),
  code_id uuid not null references public.referral_codes(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  referred_email text,
  referred_siret text,
  referred_discount numeric(10, 2) not null default 0,
  referrer_reward numeric(10, 2) not null default 0,
  reward_status text not null default 'pending'
    check (reward_status in ('pending', 'honored', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_redemptions_code
  on public.referral_redemptions (code_id);

drop trigger if exists referral_codes_set_updated_at on public.referral_codes;
create trigger referral_codes_set_updated_at
  before update on public.referral_codes
  for each row execute function public.set_updated_at();

-- ---- RLS -------------------------------------------------------------------
alter table public.referral_codes enable row level security;
alter table public.referral_redemptions enable row level security;

drop policy if exists "owner reads own referral code" on public.referral_codes;
create policy "owner reads own referral code"
  on public.referral_codes for select
  using (owner_user_id = auth.uid());

drop policy if exists "admins manage referral codes" on public.referral_codes;
create policy "admins manage referral codes"
  on public.referral_codes for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "owner reads own redemptions" on public.referral_redemptions;
create policy "owner reads own redemptions"
  on public.referral_redemptions for select
  using (
    exists (
      select 1 from public.referral_codes rc
      where rc.id = referral_redemptions.code_id
        and rc.owner_user_id = auth.uid()
    )
  );

drop policy if exists "admins manage redemptions" on public.referral_redemptions;
create policy "admins manage redemptions"
  on public.referral_redemptions for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.referral_codes to authenticated;
grant select, update on public.referral_redemptions to authenticated;

-- ---- Issue / fetch my code -------------------------------------------------
create or replace function public.get_or_create_my_referral_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_code text;
  v_code_id uuid;
  v_label text;
  v_siret text;
  v_total_uses int;
  v_pending numeric;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'get_or_create_my_referral_code: not authenticated';
  end if;

  select id, code into v_code_id, v_code
  from public.referral_codes where owner_user_id = v_uid;

  if v_code_id is null then
    select coalesce(
             nullif(trim(coalesce(up.first_name, '') || ' ' || coalesce(up.last_name, '')), ''),
             v_email
           ),
           c.siret
      into v_label, v_siret
      from public.users_profile up
      left join public.companies c on c.id = up.company_id
      where up.id = v_uid;

    loop
      v_attempt := v_attempt + 1;
      v_code := 'CC-' ||
        upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8));
      begin
        insert into public.referral_codes (
          code, owner_user_id, owner_email, owner_siret, owner_label
        )
        values (v_code, v_uid, v_email, v_siret, v_label)
        returning id into v_code_id;
        exit;
      exception when unique_violation then
        select id, code into v_code_id, v_code
        from public.referral_codes where owner_user_id = v_uid;
        if v_code_id is not null then exit; end if;
        if v_attempt >= 5 then raise; end if;
      end;
    end loop;
  end if;

  select total_uses into v_total_uses
  from public.referral_codes where id = v_code_id;
  select coalesce(sum(referrer_reward), 0) into v_pending
  from public.referral_redemptions
  where code_id = v_code_id and reward_status = 'pending';

  return jsonb_build_object(
    'code', v_code,
    'total_uses', v_total_uses,
    'pending_reward', v_pending
  );
end;
$$;

revoke execute on function public.get_or_create_my_referral_code() from public, anon;
grant execute on function public.get_or_create_my_referral_code() to authenticated;

-- ---- Preview (checkout) ----------------------------------------------------
-- Validates a code without applying it. The client computes the actual euro
-- discount as min(100, fee); the authoritative value is recomputed at creation.
create or replace function public.preview_referral_code(
  p_code text,
  p_email text,
  p_siret text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '-', 'g'));
  v_email text := lower(coalesce(p_email, ''));
  v_siret text := regexp_replace(coalesce(p_siret, ''), '\s', '', 'g');
  rc public.referral_codes;
begin
  if v_code = '' then
    return jsonb_build_object('status', 'none');
  end if;
  select * into rc from public.referral_codes where upper(code) = v_code limit 1;
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;
  if not rc.is_active then
    return jsonb_build_object('status', 'inactive', 'referrer_label', rc.owner_label);
  end if;
  if rc.expires_at is not null and rc.expires_at <= now() then
    return jsonb_build_object('status', 'expired', 'referrer_label', rc.owner_label);
  end if;
  if rc.total_uses >= rc.max_uses then
    return jsonb_build_object('status', 'exhausted', 'referrer_label', rc.owner_label);
  end if;
  if (v_siret <> '' and v_siret = coalesce(rc.owner_siret, ''))
     or (v_email <> '' and v_email = coalesce(lower(rc.owner_email), '')) then
    return jsonb_build_object('status', 'self_referral', 'referrer_label', rc.owner_label);
  end if;
  return jsonb_build_object('status', 'applied', 'referrer_label', rc.owner_label);
end;
$$;

revoke execute on function public.preview_referral_code(text, text, text) from public;
grant execute on function public.preview_referral_code(text, text, text) to anon, authenticated;

-- ---- Admin: list redemptions ----------------------------------------------
create or replace function public.admin_list_referral_redemptions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_list_referral_redemptions: admin only';
  end if;
  select coalesce(jsonb_agg(row order by created_at desc), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', r.id,
      'created_at', r.created_at,
      'referred_email', r.referred_email,
      'referrer_reward', r.referrer_reward,
      'reward_status', r.reward_status,
      'referrer_label', rc.owner_label,
      'code', rc.code,
      'reservation_ref', res.reference
    ) as row,
    r.created_at
    from public.referral_redemptions r
    join public.referral_codes rc on rc.id = r.code_id
    left join public.reservations res on res.id = r.reservation_id
  ) s;
  return v_result;
end;
$$;

revoke execute on function public.admin_list_referral_redemptions() from public, anon;
grant execute on function public.admin_list_referral_redemptions() to authenticated;

comment on table public.referral_codes is
  'Per-customer referral codes. Discount is applied server-side in create_reservation_with_items.';
comment on table public.referral_redemptions is
  'One row per successful referral; referrer_reward honoured manually by admin.';
