-- Privilege-escalation fix (audit 2026-06-11).
--
-- is_admin() trusts professionals.is_admin (see
-- 20260525093000_align_is_admin_with_profile_role.sql). But the
-- "professionals insert own"/"professionals update own" RLS policies let any
-- authenticated user write their own row WITHOUT any column guard — so a user
-- could POST/PATCH { id: <self>, is_admin: true } and self-promote to admin,
-- unlocking every admin RLS policy. users_profile already blocks this via a
-- WITH CHECK on role; professionals had no equivalent.
--
-- Lock the column at the trigger level: a non-admin caller can never set or
-- change is_admin (forced to false on insert, frozen to the old value on
-- update). Existing admins keep full control of the flag.

create or replace function public.guard_professionals_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    -- An already-admin caller may legitimately manage the flag.
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
  else
    new.is_admin := old.is_admin;
  end if;

  return new;
end;
$$;

-- Trigger-only function: never meant to be called directly via PostgREST RPC.
revoke execute on function public.guard_professionals_is_admin()
  from public, anon, authenticated;

drop trigger if exists trg_guard_professionals_is_admin on public.professionals;
create trigger trg_guard_professionals_is_admin
  before insert or update on public.professionals
  for each row execute function public.guard_professionals_is_admin();

comment on function public.guard_professionals_is_admin() is
  'Prevents non-admin users from setting/changing professionals.is_admin (privilege-escalation guard).';
