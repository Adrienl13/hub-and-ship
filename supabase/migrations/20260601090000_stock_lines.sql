-- Stock 24h inventory: warehouse-side reality check.
--
-- Until now the /stock-24h page rendered a hard-coded list of available
-- stock lines (cf. src/lib/stock.ts). The ops team can't edit it
-- without a deploy, and the fixture grew stale fast. This migration
-- promotes that list to a real DB table that the admin can CRUD from
-- the back-office, with public-read RLS so the front-end keeps working
-- anonymously.

create type public.stock_condition as enum (
  'new',
  'opened_box',
  'showroom'
);

create table public.stock_lines (
  id text primary key,
  product_id text not null references public.products(id) on delete restrict,
  variant_id text not null references public.product_variants(id) on delete restrict,
  available_units integer not null default 0 check (available_units >= 0),
  reserved_units integer not null default 0 check (reserved_units >= 0),
  stock_price_ht numeric(10, 2) not null check (stock_price_ht >= 0),
  location text not null,
  ready_label text not null default 'Retrait sous 24h',
  condition public.stock_condition not null default 'new',
  priority integer not null default 100,
  note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists stock_lines_set_updated_at on public.stock_lines;
create trigger stock_lines_set_updated_at
  before update on public.stock_lines
  for each row execute function public.set_updated_at();

alter table public.stock_lines enable row level security;

drop policy if exists "Public reads active stock lines" on public.stock_lines;
create policy "Public reads active stock lines"
  on public.stock_lines for select
  using (is_active = true);

drop policy if exists "Admins write stock lines" on public.stock_lines;
create policy "Admins write stock lines"
  on public.stock_lines for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed the table with the existing fixture so the front-end remains
-- visually identical the moment the migration ships. The id values are
-- the same as in the TS fixture, so the front-end fallback still
-- recognises them.
insert into public.stock_lines (
  id, product_id, variant_id, available_units, reserved_units,
  stock_price_ht, location, ready_label, condition, priority, note
) values
  ('stock-cannes-noir', 'p1', 'v1a', 86, 12, 109, 'Marseille-Fos',
   'Retrait sous 24h', 'new', 1,
   'Lot homogène, cartons complets, idéal terrasse à ouvrir rapidement.'),
  ('stock-monaco-anthracite', 'p4', 'v4b', 64, 0, 89, 'Marseille-Fos',
   'Retrait sous 24h', 'new', 2,
   'Assise légère, empilable, disponible sans attendre le prochain container.'),
  ('stock-lyon-teck', 'p3', 'v3a', 18, 4, 225, 'Marseille-Fos',
   'Retrait sous 24h', 'opened_box', 3,
   'Quelques cartons ouverts pour contrôle qualité, mobilier non utilisé.'),
  ('stock-malibu-naturel', 'p2', 'v2c', 22, 2, 295, 'Marseille-Fos',
   'Retrait sous 24h', 'showroom', 4,
   'Lot court pour compléter une zone lounge ou un besoin événementiel.'),
  ('stock-marseille-ardoise', 'p6', 'v6b', 9, 0, 399, 'Marseille-Fos',
   'Retrait sous 24h', 'new', 5,
   'Tables rectangulaires en quantité limitée, adaptées aux terrasses 6 places.')
on conflict (id) do nothing;
