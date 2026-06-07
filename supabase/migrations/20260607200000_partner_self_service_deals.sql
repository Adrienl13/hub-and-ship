-- Let an authenticated partner register their own opportunity from the portal.
--
-- A partner may INSERT a deal ONLY on an application they are linked to, and
-- ONLY in the `submitted` state. Protection (status protected/quoted + a
-- protected_until window) stays an admin decision, so a partner can never
-- self-protect a client. Reading/updating remain governed by the existing
-- "Partners read own deals" and admin policies.

drop policy if exists "Partners create own deals" on public.partner_deals;
create policy "Partners create own deals"
  on public.partner_deals for insert
  with check (
    application_id in (select public.current_partner_application_ids())
    and status = 'submitted'::public.partner_deal_status
  );

grant insert on public.partner_deals to authenticated;
