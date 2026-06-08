-- Legal numbered invoices for reservations.
--
-- Invoices are issued by an admin once a reservation is realised. Numbering is
-- continuous and chronological via a dedicated sequence (one shared counter,
-- never reset). Each invoice snapshots seller/buyer/amount data so it stays
-- immutable even if the reservation later changes. RLS: admins manage all;
-- a client reads only invoices of reservations they own.

create sequence if not exists public.invoice_number_seq
  as bigint start with 1 increment by 1 no cycle;

do $$
begin
  create type public.invoice_status as enum ('issued', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  reservation_id uuid not null
    references public.reservations(id) on delete restrict,
  number text not null unique,
  status public.invoice_status not null default 'issued',
  currency text not null default 'EUR',
  subtotal_ht numeric(12, 2) not null,
  vat_rate numeric(5, 2) not null,
  vat_amount numeric(12, 2) not null,
  total_ttc numeric(12, 2) not null,
  snapshot jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_reservation_issued
  on public.invoices(reservation_id, issued_at desc);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

drop policy if exists "Admins full access invoices" on public.invoices;
create policy "Admins full access invoices"
  on public.invoices for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Clients read own invoices" on public.invoices;
create policy "Clients read own invoices"
  on public.invoices for select
  using (reservation_id in (select r.id from public.reservations r));

-- Atomic issuance: admin-only, allocates the next number and snapshots the
-- reservation. SECURITY DEFINER so it can read the reservation + sequence.
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

revoke execute on function public.issue_reservation_invoice(uuid) from public, anon;
grant execute on function public.issue_reservation_invoice(uuid) to authenticated;

grant select on public.invoices to anon, authenticated;
grant insert, update on public.invoices to authenticated;

comment on table public.invoices is
  'Legal numbered invoices for reservations; continuous numbering via invoice_number_seq.';
comment on function public.issue_reservation_invoice(uuid) is
  'Admin-only atomic issuance: allocates the next invoice number and snapshots the reservation.';
