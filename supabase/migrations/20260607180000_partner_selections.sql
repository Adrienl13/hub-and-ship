-- Persistent co-branded partner selections.
--
-- A partner curates a product selection (quantities + a note) and shares it as
-- `/p/{slug}?selection={id}`. The selection stores ONLY public catalogue data
-- (public price HT, eco contribution, image) so a final client never sees net
-- partner pricing. A partner manages only their own selections; published
-- selections are world-readable so the share link works without auth.

do $$
begin
  create type public.partner_selection_status as enum (
    'draft', 'published', 'archived'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partner_selections (
  id uuid primary key default extensions.gen_random_uuid(),
  partner_application_id uuid not null
    references public.partner_applications(id) on delete cascade,
  title text not null,
  comment text,
  status public.partner_selection_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_selections_application_created
  on public.partner_selections(partner_application_id, created_at desc);

create index if not exists idx_partner_selections_status
  on public.partner_selections(status)
  where status = 'published';

create table if not exists public.partner_selection_items (
  id uuid primary key default extensions.gen_random_uuid(),
  selection_id uuid not null
    references public.partner_selections(id) on delete cascade,
  product_id text not null,
  variant_id text,
  variant_name text,
  quantity int not null default 1 check (quantity between 1 and 100000),
  position int not null default 0,
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_selection_items_selection
  on public.partner_selection_items(selection_id, position);

drop trigger if exists partner_selections_set_updated_at
  on public.partner_selections;
create trigger partner_selections_set_updated_at
  before update on public.partner_selections
  for each row execute function public.set_updated_at();

alter table public.partner_selections enable row level security;
alter table public.partner_selection_items enable row level security;

-- Partner-owned management (a partner only ever touches their own selections).
drop policy if exists "Partners manage own selections" on public.partner_selections;
create policy "Partners manage own selections"
  on public.partner_selections for all
  using (
    partner_application_id in (select public.current_partner_application_ids())
  )
  with check (
    partner_application_id in (select public.current_partner_application_ids())
  );

drop policy if exists "Admins full access selections" on public.partner_selections;
create policy "Admins full access selections"
  on public.partner_selections for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

-- Published selections are world-readable so the share link works anonymously.
drop policy if exists "Public reads published selections"
  on public.partner_selections;
create policy "Public reads published selections"
  on public.partner_selections for select
  using (status = 'published');

drop policy if exists "Partners manage own selection items"
  on public.partner_selection_items;
create policy "Partners manage own selection items"
  on public.partner_selection_items for all
  using (
    selection_id in (
      select s.id from public.partner_selections s
      where s.partner_application_id in (
        select public.current_partner_application_ids()
      )
    )
  )
  with check (
    selection_id in (
      select s.id from public.partner_selections s
      where s.partner_application_id in (
        select public.current_partner_application_ids()
      )
    )
  );

drop policy if exists "Admins full access selection items"
  on public.partner_selection_items;
create policy "Admins full access selection items"
  on public.partner_selection_items for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Public reads items of published selections"
  on public.partner_selection_items;
create policy "Public reads items of published selections"
  on public.partner_selection_items for select
  using (
    selection_id in (
      select s.id from public.partner_selections s where s.status = 'published'
    )
  );

grant select on public.partner_selections to anon, authenticated;
grant insert, update, delete on public.partner_selections to authenticated;
grant select on public.partner_selection_items to anon, authenticated;
grant insert, update, delete on public.partner_selection_items to authenticated;

comment on table public.partner_selections is
  'Co-branded product selections curated by a partner, shared via /p/{slug}?selection={id}.';
comment on column public.partner_selection_items.product_snapshot is
  'Public catalogue snapshot (name, image, public price HT, eco) — never net partner pricing.';
