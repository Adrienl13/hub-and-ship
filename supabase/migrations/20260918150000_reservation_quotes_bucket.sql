-- 52. Rattrapage : le bucket `reservation-quotes` n'existait qu'en production.
--
-- Il y a été créé à la main le 14 juin 2026, avec sa politique RLS, et aucune
-- migration ne le décrit. Conséquence : une base reconstruite depuis ce dépôt
-- (environnement de test, bascule de projet, restauration) n'a pas le bucket.
-- L'upload d'un devis signé depuis l'admin échoue alors avec « Bucket not
-- found », sans que rien n'indique que c'est l'environnement qui est
-- incomplet et non le code.
--
-- Cette migration ne fait que DÉCRIRE l'existant : mêmes id, visibilité,
-- taille limite et types MIME qu'en production (privé, 10 Mo, PDF seulement),
-- et la même politique — l'accès passe par des URLs signées côté serveur, le
-- rôle service contourne déjà RLS, on n'ouvre donc que le chemin admin.
-- `on conflict` et `drop policy if exists` : rejouer sur la production ne
-- change rien.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reservation-quotes',
  'reservation-quotes',
  false,
  10485760, -- 10 Mo
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins manage reservation quotes objects" on storage.objects;
create policy "Admins manage reservation quotes objects"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'reservation-quotes'
    and public.current_user_role() in ('admin', 'super_admin')
  )
  with check (
    bucket_id = 'reservation-quotes'
    and public.current_user_role() in ('admin', 'super_admin')
  );
