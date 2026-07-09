-- Authoritative referral validation for reservation creation.
--
-- The checkout RPC revalidates catalogue prices, but referral amounts must also
-- be enforced by the database. These triggers make referral_code/referral_discount
-- and pay_now consistent for every inserted reservation, then record the
-- redemption atomically. If a later step in the checkout transaction fails, the
-- redemption and total_uses update roll back with it.

create or replace function public.validate_reservation_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(new.referral_code, ''), '\s+', '-', 'g'));
  v_email text := lower(coalesce(new.contact_snapshot ->> 'email', ''));
  v_siret text := regexp_replace(coalesce(new.siret, ''), '\s', '', 'g');
  v_program_active boolean := true;
  v_discount numeric := 100;
  v_expected_discount numeric := 0;
  v_expected_pay_now numeric;
  rc public.referral_codes;
  c_tol constant numeric := 0.05;
begin
  if new.status is distinct from 'pending_reservation_fee'::public.reservation_status
     or new.user_id is not null
     or new.company_id is not null then
    return new;
  end if;

  if v_code = '' then
    new.referral_code := null;
    if abs(coalesce(new.referral_discount, 0)) > c_tol then
      raise exception 'validate_reservation_referral: discount requires a referral code';
    end if;
    if abs(coalesce(new.pay_now, 0) - coalesce(new.reservation_fee, 0)) > c_tol then
      raise exception 'validate_reservation_referral: pay_now must equal reservation_fee without referral';
    end if;
    return new;
  end if;

  select referred_discount, is_active
    into v_discount, v_program_active
  from public.referral_program_settings
  where id = true;

  if not coalesce(v_program_active, true) then
    raise exception 'validate_reservation_referral: referral program inactive';
  end if;

  select * into rc
  from public.referral_codes
  where upper(code) = v_code
  for update;

  if not found then
    raise exception 'validate_reservation_referral: unknown referral code';
  end if;
  if not rc.is_active then
    raise exception 'validate_reservation_referral: inactive referral code';
  end if;
  if rc.expires_at is not null and rc.expires_at <= now() then
    raise exception 'validate_reservation_referral: expired referral code';
  end if;
  if rc.total_uses >= rc.max_uses then
    raise exception 'validate_reservation_referral: exhausted referral code';
  end if;
  if (v_siret <> '' and v_siret = coalesce(rc.owner_siret, ''))
     or (v_email <> '' and v_email = coalesce(lower(rc.owner_email), '')) then
    raise exception 'validate_reservation_referral: self referral forbidden';
  end if;

  v_expected_discount := least(coalesce(v_discount, 100), new.reservation_fee);
  v_expected_pay_now := greatest(new.reservation_fee - v_expected_discount, 0);

  if abs(new.referral_discount - v_expected_discount) > c_tol
     or abs(new.pay_now - v_expected_pay_now) > c_tol then
    raise exception 'validate_reservation_referral: inconsistent referral payment amounts';
  end if;

  new.referral_code := rc.code;
  return new;
end;
$$;

create or replace function public.record_reservation_referral_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(new.referral_code, ''), '\s+', '-', 'g'));
  v_reward numeric := 100;
  v_code_id uuid;
begin
  if new.status is distinct from 'pending_reservation_fee'::public.reservation_status
     or new.user_id is not null
     or new.company_id is not null then
    return new;
  end if;

  if v_code = '' or coalesce(new.referral_discount, 0) <= 0 then
    return new;
  end if;

  select referrer_reward into v_reward
  from public.referral_program_settings
  where id = true;

  select id into v_code_id
  from public.referral_codes
  where upper(code) = v_code
  for update;

  if v_code_id is null then
    raise exception 'record_reservation_referral_redemption: referral code disappeared';
  end if;

  insert into public.referral_redemptions (
    code_id,
    reservation_id,
    referred_email,
    referred_siret,
    referred_discount,
    referrer_reward
  )
  values (
    v_code_id,
    new.id,
    lower(nullif(new.contact_snapshot ->> 'email', '')),
    regexp_replace(coalesce(new.siret, ''), '\s', '', 'g'),
    new.referral_discount,
    coalesce(v_reward, 100)
  );

  update public.referral_codes
    set total_uses = total_uses + 1
    where id = v_code_id;

  return new;
end;
$$;

revoke execute on function public.validate_reservation_referral()
  from public, anon, authenticated;
revoke execute on function public.record_reservation_referral_redemption()
  from public, anon, authenticated;

drop trigger if exists trg_validate_reservation_referral on public.reservations;
create trigger trg_validate_reservation_referral
  before insert on public.reservations
  for each row execute function public.validate_reservation_referral();

drop trigger if exists trg_record_reservation_referral_redemption on public.reservations;
create trigger trg_record_reservation_referral_redemption
  after insert on public.reservations
  for each row execute function public.record_reservation_referral_redemption();

comment on function public.validate_reservation_referral() is
  'Validates referral code state and enforces referral_discount/pay_now before reservation insert.';
comment on function public.record_reservation_referral_redemption() is
  'Records referral redemption and increments total_uses atomically after reservation insert.';
