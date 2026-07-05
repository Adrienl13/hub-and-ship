-- Account recovery / reservation linking (audit Sprint 2, 2026-06-11).
--
-- Public checkout always inserts reservations with user_id = NULL (anonymous,
-- by design — see create_reservation_with_items). The "Users see own
-- reservations" RLS policy requires user_id = auth.uid(), so a signed-in user
-- never sees their own reservations server-side: the account page only worked
-- via the device's localStorage history, which breaks across browsers/devices
-- and makes the SAV (reservation_claims) unreachable.
--
-- This SECURITY DEFINER RPC adopts every still-unlinked reservation whose
-- checkout contact email matches the caller's VERIFIED email (magic-link), and
-- attaches it to their account. A user can only ever claim reservations made
-- with an email they control, so there is no cross-account leak.

create or replace function public.claim_my_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_count integer := 0;
begin
  if v_uid is null or v_email is null then
    return 0;
  end if;

  update public.reservations
     set user_id = v_uid
   where user_id is null
     and lower(contact_snapshot ->> 'email') = v_email;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.claim_my_reservations() from public, anon;
grant execute on function public.claim_my_reservations() to authenticated;

comment on function public.claim_my_reservations() is
  'Links still-unlinked reservations whose checkout contact email matches the signed-in user verified email to that user (cross-device account recovery).';
