-- Official reservation quote PDFs.
--
-- Admins upload final quote PDFs to a private bucket and store the object path on
-- the reservation. Clients never read the bucket directly: quote-access.ts checks
-- ownership server-side, then signs a short-lived URL with the service role.

alter table public.reservations
  add column if not exists quote_pdf_path text;

comment on column public.reservations.quote_pdf_path is
  'Private storage path in the reservation-quotes bucket for the official quote PDF.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reservation-quotes',
  'reservation-quotes',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins manage reservation quote objects" on storage.objects;
create policy "Admins manage reservation quote objects"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'reservation-quotes'
    and public.is_admin()
  )
  with check (
    bucket_id = 'reservation-quotes'
    and public.is_admin()
  );
