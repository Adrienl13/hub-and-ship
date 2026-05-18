-- Public stock-24h requests captured from the urgent availability page.

do $$
begin
  create type public.stock_request_status as enum (
    'new',
    'contacted',
    'reserved',
    'converted',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.stock_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  status public.stock_request_status not null default 'new',
  stock_line_id text not null,
  product_id text not null,
  sku text not null,
  product_name text not null,
  variant_id text not null,
  variant_name text not null,
  requested_quantity int not null check (requested_quantity > 0),
  available_units_snapshot int not null check (available_units_snapshot >= 0),
  unit_price_ht numeric(10, 2) not null,
  estimated_total_ht numeric(10, 2) not null,
  company_name text not null,
  contact_email text not null,
  contact_phone text not null,
  location text not null,
  customer_note text,
  internal_note text,
  product_snapshot jsonb not null,
  source text not null default 'stock_24h_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_requests_status_created
  on public.stock_requests(status, created_at desc);

create index if not exists idx_stock_requests_email_created
  on public.stock_requests(lower(contact_email), created_at desc);

drop trigger if exists stock_requests_set_updated_at on public.stock_requests;
create trigger stock_requests_set_updated_at
  before update on public.stock_requests
  for each row execute function public.set_updated_at();

alter table public.stock_requests enable row level security;

drop policy if exists "Public creates stock requests" on public.stock_requests;
create policy "Public creates stock requests"
  on public.stock_requests for insert
  with check (true);

drop policy if exists "Admins full access stock requests" on public.stock_requests;
create policy "Admins full access stock requests"
  on public.stock_requests for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
