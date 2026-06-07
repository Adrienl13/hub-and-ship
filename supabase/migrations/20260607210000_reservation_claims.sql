-- Client SAV / claims on a reservation.
--
-- A signed-in client can open a claim (damage, missing item, wrong reference,
-- delay…) on a reservation they own and follow its status. RLS scopes a client
-- to their own claims AND to reservations they can already see (the subquery
-- runs under the caller's reservation RLS), so nobody can file a claim on
-- someone else's order. Admins manage status and responses.

do $$
begin
  create type public.reservation_claim_category as enum (
    'damaged', 'missing', 'wrong_item', 'delay', 'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reservation_claim_status as enum (
    'open', 'in_review', 'resolved', 'rejected'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.reservation_claims (
  id uuid primary key default extensions.gen_random_uuid(),
  reservation_id uuid not null
    references public.reservations(id) on delete cascade,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  category public.reservation_claim_category not null default 'other',
  status public.reservation_claim_status not null default 'open',
  quantity int check (quantity is null or quantity between 1 and 100000),
  message text not null,
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservation_claims_reservation
  on public.reservation_claims(reservation_id, created_at desc);
create index if not exists idx_reservation_claims_user
  on public.reservation_claims(user_id, created_at desc);
create index if not exists idx_reservation_claims_status
  on public.reservation_claims(status, created_at desc);

drop trigger if exists reservation_claims_set_updated_at
  on public.reservation_claims;
create trigger reservation_claims_set_updated_at
  before update on public.reservation_claims
  for each row execute function public.set_updated_at();

alter table public.reservation_claims enable row level security;

drop policy if exists "Clients create own claims" on public.reservation_claims;
create policy "Clients create own claims"
  on public.reservation_claims for insert
  with check (
    user_id = auth.uid()
    and status = 'open'::public.reservation_claim_status
    and reservation_id in (select r.id from public.reservations r)
  );

drop policy if exists "Clients read own claims" on public.reservation_claims;
create policy "Clients read own claims"
  on public.reservation_claims for select
  using (user_id = auth.uid());

drop policy if exists "Admins full access claims" on public.reservation_claims;
create policy "Admins full access claims"
  on public.reservation_claims for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

grant select, insert on public.reservation_claims to authenticated;

comment on table public.reservation_claims is
  'Client after-sales claims on a reservation; RLS-scoped to the owner and admins.';
