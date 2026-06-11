-- Concurrency fix (audit 2026-06-11).
--
-- issue_reservation_invoice() guards against duplicates with a check-then-insert
-- (IF EXISTS ... issued ... THEN raise). Under READ COMMITTED, two concurrent
-- admin calls can both pass the EXISTS check and then both INSERT, allocating
-- two legal invoice numbers for the same reservation. Enforce the invariant in
-- the database with a partial unique index so the race is impossible; the
-- application-level check remains as a friendly error message.
--
-- Safe to apply: verified zero reservations currently carry more than one
-- 'issued' invoice.

create unique index if not exists uq_invoices_one_issued_per_reservation
  on public.invoices (reservation_id)
  where status = 'issued';

comment on index public.uq_invoices_one_issued_per_reservation is
  'At most one issued invoice per reservation (prevents concurrent double issuance).';
