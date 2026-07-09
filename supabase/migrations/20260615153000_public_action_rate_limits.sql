-- Lightweight database-side throttling for public submission/RPC surfaces.
--
-- Postgres does not receive the caller IP through PostgREST/RPC, so these
-- limits key on stable business identifiers that are already supplied by the
-- forms: email, SIRET, or referral code. This is not a replacement for edge
-- rate limiting/Captcha, but it prevents accidental loops and low-effort spam.

create table if not exists public.public_action_rate_limits (
  action text not null,
  key text not null,
  window_start timestamptz not null,
  attempts int not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (action, key, window_start)
);

create index if not exists idx_public_action_rate_limits_updated
  on public.public_action_rate_limits(updated_at);

alter table public.public_action_rate_limits enable row level security;

drop policy if exists "Admins read public action rate limits"
  on public.public_action_rate_limits;
create policy "Admins read public action rate limits"
  on public.public_action_rate_limits for select
  using (public.is_admin());

grant select on public.public_action_rate_limits to authenticated;

create or replace function public.assert_public_action_rate_limit(
  p_action text,
  p_key text,
  p_max_attempts int,
  p_window_seconds int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_key text := lower(btrim(coalesce(p_key, '')));
  v_window_seconds int := greatest(coalesce(p_window_seconds, 3600), 60);
  v_window_start timestamptz;
  v_attempts int;
begin
  if v_action = '' or v_key = '' then
    return;
  end if;
  if p_max_attempts is null or p_max_attempts < 1 then
    raise exception 'assert_public_action_rate_limit: invalid max attempts';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / v_window_seconds)
    * v_window_seconds
  );

  insert into public.public_action_rate_limits (
    action,
    key,
    window_start,
    attempts,
    updated_at
  )
  values (v_action, v_key, v_window_start, 1, now())
  on conflict (action, key, window_start) do update
    set attempts = public.public_action_rate_limits.attempts + 1,
        updated_at = now()
  returning attempts into v_attempts;

  if v_attempts > p_max_attempts then
    raise exception 'rate_limited';
  end if;
end;
$$;

revoke execute on function public.assert_public_action_rate_limit(text, text, int, int)
  from public, anon, authenticated;

create or replace function public.guard_stock_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_public_action_rate_limit(
    'stock_request',
    lower(coalesce(new.contact_email, '')),
    5,
    3600
  );
  return new;
end;
$$;

revoke execute on function public.guard_stock_request_rate_limit()
  from public, anon, authenticated;

drop trigger if exists trg_stock_request_rate_limit on public.stock_requests;
create trigger trg_stock_request_rate_limit
  before insert on public.stock_requests
  for each row execute function public.guard_stock_request_rate_limit();

create or replace function public.subscribe_container_notification(
  p_email text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'subscribe_container_notification: invalid email';
  end if;

  perform public.assert_public_action_rate_limit(
    'container_notify',
    v_email,
    3,
    86400
  );

  insert into public.container_notify_leads (email, source)
  values (v_email, nullif(btrim(coalesce(p_source, '')), ''))
  on conflict (lower(email)) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.subscribe_container_notification(text, text)
  from public;
grant execute on function public.subscribe_container_notification(text, text)
  to anon, authenticated;

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

  perform public.assert_public_action_rate_limit(
    'preview_referral_code',
    coalesce(nullif(v_email, ''), nullif(v_siret, ''), v_code),
    30,
    3600
  );

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

revoke execute on function public.preview_referral_code(text, text, text)
  from public;
grant execute on function public.preview_referral_code(text, text, text)
  to anon, authenticated;

comment on table public.public_action_rate_limits is
  'Lightweight per-action counters for public RPC/form throttling.';
comment on function public.assert_public_action_rate_limit(text, text, int, int) is
  'Private helper that raises rate_limited after too many attempts for an action/key/window.';
