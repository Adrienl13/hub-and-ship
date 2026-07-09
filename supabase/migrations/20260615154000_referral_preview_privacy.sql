-- Minimise referral-code enumeration leakage.
--
-- preview_referral_code remains public so checkout can validate a code before
-- reservation creation, but it should only reveal the referrer label when the
-- code is genuinely applicable. Inactive/expired/exhausted/self-referral states
-- keep their status for UX, without exposing owner_label.

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
    return jsonb_build_object('status', 'inactive');
  end if;
  if rc.expires_at is not null and rc.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if rc.total_uses >= rc.max_uses then
    return jsonb_build_object('status', 'exhausted');
  end if;
  if (v_siret <> '' and v_siret = coalesce(rc.owner_siret, ''))
     or (v_email <> '' and v_email = coalesce(lower(rc.owner_email), '')) then
    return jsonb_build_object('status', 'self_referral');
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

comment on function public.preview_referral_code(text, text, text) is
  'Public checkout preview with rate limiting; reveals referrer_label only for applicable codes.';
