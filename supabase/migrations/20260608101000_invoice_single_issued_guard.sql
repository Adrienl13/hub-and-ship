-- Prevent accidental duplicate invoices: a reservation can carry at most one
-- 'issued' invoice. Re-issuing raises instead of allocating a second number.

create or replace function public.issue_reservation_invoice(
  p_reservation_id uuid
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res public.reservations;
  v_number text;
  v_invoice public.invoices;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'issue_reservation_invoice: admin only';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id;
  if not found then
    raise exception 'issue_reservation_invoice: reservation not found';
  end if;

  if exists (
    select 1 from public.invoices
    where reservation_id = p_reservation_id and status = 'issued'
  ) then
    raise exception 'issue_reservation_invoice: an invoice already exists for this reservation';
  end if;

  v_number := 'FAC-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');

  insert into public.invoices (
    reservation_id, number, status, currency,
    subtotal_ht, vat_rate, vat_amount, total_ttc,
    snapshot, created_by
  )
  values (
    v_res.id,
    v_number,
    'issued',
    'EUR',
    v_res.total_ht,
    coalesce(v_res.vat_rate, 20.00),
    v_res.vat_amount,
    v_res.total_ttc,
    jsonb_build_object(
      'reference', v_res.reference,
      'container_reference', v_res.container_reference,
      'siret', v_res.siret,
      'contact', v_res.contact_snapshot,
      'subtotal_ht', v_res.subtotal_ht,
      'eco_contribution_total', v_res.eco_contribution_total
    ),
    auth.uid()
  )
  returning * into v_invoice;

  return v_invoice;
end;
$$;
