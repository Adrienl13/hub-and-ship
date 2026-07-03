-- LOT 6 — Partner self-read RLS.
--
-- The connected partner space (/partenaire) lets an apporteur read THEIR OWN
-- partner codes and commission ledger. Scoped to the partner's company via
-- current_company_id(); admins keep full access from the earlier policies.
-- A partner can never see another partner's codes or commissions.

drop policy if exists "Partners read own codes" on public.partner_codes;
create policy "Partners read own codes"
  on public.partner_codes
  for select
  using (company_id = public.current_company_id());

drop policy if exists "Partners read own commissions" on public.commission_ledger;
create policy "Partners read own commissions"
  on public.commission_ledger
  for select
  using (
    partner_code_id in (
      select id from public.partner_codes
      where company_id = public.current_company_id()
    )
  );

comment on policy "Partners read own commissions" on public.commission_ledger is
  'A partner reads only the ledger rows tied to their own company''s partner codes (LOT 6 connected space).';
