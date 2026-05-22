-- Quality / test reports (SGS AQL, Eurofins, CE compliance, TÜV…)
-- Metadata is public (build trust), full file requires authenticated access.

do $$
begin
  create type public.quality_report_organization as enum ('sgs','eurofins','tuv','bureau_veritas','dekra','intertek','other');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.quality_report_type as enum (
    'aql_inspection',
    'pre_shipment_inspection',
    'ce_compliance',
    'fire_rating',
    'material_test',
    'reach_compliance',
    'load_test',
    'eco_certification',
    'other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.quality_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  container_id uuid references public.containers(id) on delete set null,
  organization public.quality_report_organization not null,
  report_type public.quality_report_type not null,
  reference_number text not null,
  issued_at date not null,
  product_categories text[] not null default '{}'::text[],
  title text not null,
  summary text,
  highlights jsonb not null default '[]'::jsonb,
  file_path text,
  file_size_bytes integer check (file_size_bytes is null or file_size_bytes > 0),
  file_mime text,
  preview_image_url text,
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quality_reports_org_ref_unique
  on public.quality_reports (organization, reference_number);

create index if not exists quality_reports_container_idx
  on public.quality_reports (container_id, issued_at desc)
  where container_id is not null;

create index if not exists quality_reports_published_idx
  on public.quality_reports (published_at desc nulls last)
  where published_at is not null and is_active = true;

drop trigger if exists quality_reports_set_updated_at on public.quality_reports;
create trigger quality_reports_set_updated_at
  before update on public.quality_reports
  for each row execute function public.set_updated_at();

alter table public.quality_reports enable row level security;

-- Public sees metadata of published, active reports (NOT the file_path which
-- still goes through Supabase Storage signed URLs requested by an authed user).
drop policy if exists "Public reads published quality reports" on public.quality_reports;
create policy "Public reads published quality reports"
  on public.quality_reports for select
  to anon, authenticated
  using (is_active = true and published_at is not null);

-- Admins manage everything
drop policy if exists "Admins full access quality reports" on public.quality_reports;
create policy "Admins full access quality reports"
  on public.quality_reports for all
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

comment on column public.quality_reports.file_path is 'Supabase Storage path (private bucket). Signed URL generated server-side for authenticated users only.';
comment on column public.quality_reports.highlights is 'Array<{label: text, value: text}> short audit metrics surfaced on the public card';
comment on column public.quality_reports.product_categories is 'product_category[] covered by this report (chair, armchair, table, bench)';
