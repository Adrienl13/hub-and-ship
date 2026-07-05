-- Harden partner attribution function grants.
--
-- The partner attribution helpers are SECURITY DEFINER and only ever invoked
-- from the `reservations_set_partner_attribution` trigger, which runs as the
-- table owner regardless of the caller's EXECUTE privilege. The original
-- partner migrations only did `revoke execute ... from public`, but Supabase
-- grants EXECUTE to the `anon` and `authenticated` roles directly, so these
-- functions were still reachable via `/rest/v1/rpc/...`.
--
-- `find_partner_protected_deal` and `find_partner_link_attribution` return
-- `partner_company_name` and `partner_contact_email`, so a public caller could
-- probe a SIRET/email/slug and learn the protected partner's identity and
-- prospect data. That violates the non-negotiable rule that partner prospect
-- data stays admin-only. Revoke EXECUTE from anon/authenticated; the trigger
-- keeps working because it fires with the table owner's privileges.

revoke execute on function
  public.find_partner_protected_deal(text, text, timestamptz)
  from anon, authenticated;

revoke execute on function
  public.find_partner_link_attribution(text, timestamptz)
  from anon, authenticated;

revoke execute on function
  public.set_reservation_partner_attribution()
  from anon, authenticated;
