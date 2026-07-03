-- LOT 5 — Apporteur commission ledger (replaces the B2C referral credit).
--
-- Program: 8% commission on collected revenue (CA encaissé) of every referred
-- client, for 12 months from the client's first-touch referral. Ledger entries
-- are written ONLY at full payment (decision #3), idempotently, and never
-- deleted — cancellations/refunds add a negative "reversal" row for accounting
-- traceability.

create table if not exists public.partner_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,                 -- ex. DBP-13 (short, printable on a QR)
  company_id uuid not null references public.companies(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_codes_company
  on public.partner_codes (company_id);

-- First-touch referral link, locked at the referred client's 1st reservation
-- and never modified afterwards (set server-side; see the accrual handler).
alter table public.companies
  add column if not exists referred_by_partner_id uuid
    references public.partner_codes(id),
  add column if not exists referred_at timestamptz;

create table if not exists public.commission_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  partner_code_id uuid not null references public.partner_codes(id),
  reservation_id uuid not null references public.reservations(id),
  base_amount_ht numeric(12,2) not null,     -- collected HT (negative on reversal)
  rate numeric(5,2) not null default 8.00,
  amount numeric(12,2) not null,             -- base × rate/100
  status text not null default 'accrued'
    check (status in ('accrued', 'payable', 'paid')),
  phase text not null default 'accrual'
    check (phase in ('accrual', 'reversal')),
  accrued_at timestamptz not null default now(),
  paid_at timestamptz,
  -- Idempotency: one accrual (and at most one reversal) per reservation.
  unique (reservation_id, phase)
);

create index if not exists idx_commission_ledger_partner_status
  on public.commission_ledger (partner_code_id, status);

create index if not exists idx_commission_ledger_accrued_at
  on public.commission_ledger (accrued_at desc);

-- RLS: admin/super_admin manage everything. Partner self-read comes in LOT 6.
alter table public.partner_codes enable row level security;
alter table public.commission_ledger enable row level security;

drop policy if exists "Admins manage partner codes" on public.partner_codes;
create policy "Admins manage partner codes"
  on public.partner_codes
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins manage commission ledger" on public.commission_ledger;
create policy "Admins manage commission ledger"
  on public.commission_ledger
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

comment on table public.commission_ledger is
  'Apporteur commissions. Write-once accrual at full payment (idempotent on reservation_id+phase); refunds add a negative reversal row, never a delete.';
comment on column public.companies.referred_at is
  'First-touch: locked at the referred client''s 1st reservation, never modified. Starts the 12-month commission window.';
