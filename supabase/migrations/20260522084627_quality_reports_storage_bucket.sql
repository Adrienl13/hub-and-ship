-- Provision the private Supabase Storage bucket for quality reports PDFs
-- + admin RLS policy on storage.objects. Service-role (used by the signed-URL
-- server fn) already bypasses RLS, so this only opens the upload path for
-- admin sessions (Dashboard or future client-side admin UI).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quality-reports',
  'quality-reports',
  false,
  10485760, -- 10 MB
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can manage quality reports objects" on storage.objects;
create policy "Admins can manage quality reports objects"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'quality-reports'
    and public.current_user_role() in ('admin', 'super_admin')
  )
  with check (
    bucket_id = 'quality-reports'
    and public.current_user_role() in ('admin', 'super_admin')
  );
