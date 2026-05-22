-- Enrich public.containers for the editorial "Containers livrés" feature.
-- All columns optional → existing rows untouched. published_at gates visibility.

alter table public.containers
  add column if not exists slug text,
  add column if not exists origin_port text,
  add column if not exists total_items integer check (total_items is null or total_items >= 0),
  add column if not exists professionals_served integer check (professionals_served is null or professionals_served >= 0),
  add column if not exists savings_total_eur numeric(10, 2) check (savings_total_eur is null or savings_total_eur >= 0),
  add column if not exists savings_percent integer check (savings_percent is null or (savings_percent >= 0 and savings_percent <= 100)),
  add column if not exists story text,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists timeline jsonb not null default '[]'::jsonb,
  add column if not exists product_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists testimonial_long_quote text,
  add column if not exists testimonial_role text,
  add column if not exists published_at timestamptz;

create unique index if not exists containers_slug_unique
  on public.containers (slug)
  where slug is not null;

create index if not exists containers_published_idx
  on public.containers (published_at desc nulls last)
  where published_at is not null;

comment on column public.containers.published_at is 'When set, the container is visible in the public /livres feed. NULL = admin draft.';
comment on column public.containers.timeline is 'Array<{date: ISO string, label: text, description: text, status: "done"|"delay"}>';
comment on column public.containers.product_breakdown is 'Array<{category: product_category, units: int, modelLabel: text}>';
comment on column public.containers.gallery is 'Array<{url: text, caption: text}>';
comment on column public.containers.certifications is 'Array<text> badges';
