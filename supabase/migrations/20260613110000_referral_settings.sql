-- Configurable referral amounts (2026-06-13).
--
-- The referred discount and referrer reward were hardcoded at 100 EUR in the
-- RPCs. Move them to a single-row settings table that an admin can edit, and
-- have preview_referral_code / create_reservation_with_items / the account
-- summary read the live values.

create table if not exists public.referral_program_settings (
  id boolean primary key default true check (id),
  referred_discount numeric(10, 2) not null default 100,
  referrer_reward numeric(10, 2) not null default 100,
  is_active boolean not null default true,
  max_uses_per_code int not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.referral_program_settings (id) values (true)
  on conflict (id) do nothing;

alter table public.referral_program_settings enable row level security;

drop policy if exists "admins manage referral settings" on public.referral_program_settings;
create policy "admins manage referral settings"
  on public.referral_program_settings for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.referral_program_settings to authenticated;

-- ---- Admin read / write ----------------------------------------------------
create or replace function public.get_referral_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.referral_program_settings;
begin
  if not public.is_admin() then
    raise exception 'get_referral_settings: admin only';
  end if;
  select * into s from public.referral_program_settings where id = true;
  return jsonb_build_object(
    'referred_discount', s.referred_discount,
    'referrer_reward', s.referrer_reward,
    'is_active', s.is_active,
    'max_uses_per_code', s.max_uses_per_code
  );
end;
$$;

revoke execute on function public.get_referral_settings() from public, anon;
grant execute on function public.get_referral_settings() to authenticated;

create or replace function public.update_referral_settings(
  p_referred_discount numeric,
  p_referrer_reward numeric,
  p_is_active boolean,
  p_max_uses_per_code int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'update_referral_settings: admin only';
  end if;
  if p_referred_discount is null or p_referred_discount < 0
     or p_referrer_reward is null or p_referrer_reward < 0
     or p_max_uses_per_code is null or p_max_uses_per_code < 1 then
    raise exception 'update_referral_settings: invalid values';
  end if;

  update public.referral_program_settings
    set referred_discount = round(p_referred_discount, 2),
        referrer_reward = round(p_referrer_reward, 2),
        is_active = coalesce(p_is_active, true),
        max_uses_per_code = p_max_uses_per_code,
        updated_at = now(),
        updated_by = auth.uid()
    where id = true;

  return public.get_referral_settings();
end;
$$;

revoke execute on function public.update_referral_settings(numeric, numeric, boolean, int) from public, anon;
grant execute on function public.update_referral_settings(numeric, numeric, boolean, int) to authenticated;

-- ---- preview now returns the configured discount + honours is_active --------
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
  v_discount numeric;
  v_active boolean;
begin
  if v_code = '' then
    return jsonb_build_object('status', 'none');
  end if;
  select referred_discount, is_active into v_discount, v_active
  from public.referral_program_settings where id = true;
  if not coalesce(v_active, true) then
    return jsonb_build_object('status', 'inactive');
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
  return jsonb_build_object(
    'status', 'applied',
    'referrer_label', rc.owner_label,
    'discount', coalesce(v_discount, 100)
  );
end;
$$;

revoke execute on function public.preview_referral_code(text, text, text) from public;
grant execute on function public.preview_referral_code(text, text, text) to anon, authenticated;

-- ---- account summary also returns current amounts --------------------------
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
  v_discount numeric;
  v_reward numeric;
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
  select referred_discount, referrer_reward into v_discount, v_reward
  from public.referral_program_settings where id = true;

  return jsonb_build_object(
    'code', v_code,
    'total_uses', v_total_uses,
    'pending_reward', v_pending,
    'referred_discount', coalesce(v_discount, 100),
    'referrer_reward', coalesce(v_reward, 100)
  );
end;
$$;

revoke execute on function public.get_or_create_my_referral_code() from public, anon;
grant execute on function public.get_or_create_my_referral_code() to authenticated;
