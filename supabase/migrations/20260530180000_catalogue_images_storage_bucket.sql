-- Public Supabase Storage bucket for catalogue & container images.
--
-- Why a separate bucket from `quality-reports`:
--   - `quality-reports` is PRIVATE (PDFs gated by signed URLs).
--   - Catalogue images need to render on anonymous public pages
--     (/catalogue, /livres, ProductGallery) without round-tripping a
--     signed URL on every load, so the bucket is public-read.
--
-- Writes are gated by RLS so only admins (via is_admin(), which honours
-- both `users_profile.role` and `professionals.is_admin`) can upload,
-- replace, or delete objects in this bucket. Reads are open.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogue-images',
  'catalogue-images',
  true,
  5242880, -- 5 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads catalogue images" on storage.objects;
create policy "Public reads catalogue images"
  on storage.objects
  for select
  using (bucket_id = 'catalogue-images');

drop policy if exists "Admins manage catalogue images" on storage.objects;
create policy "Admins manage catalogue images"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'catalogue-images'
    and public.is_admin()
  )
  with check (
    bucket_id = 'catalogue-images'
    and public.is_admin()
  );
