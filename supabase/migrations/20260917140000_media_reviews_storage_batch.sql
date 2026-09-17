-- 45. Relecture photo : ajouter les fiches dont les visuels vivent sur Supabase Storage.
--
-- La migration 44 n'a mis en file que les fiches servies depuis /catalogue/…,
-- parce que ce sont les lots fournisseur versés en masse. Mais l'audit du
-- 17 septembre 2026 note noir sur blanc que les visuels hébergés sur
-- Supabase Storage n'ont **pas** pu être inspectés du tout : ils ne se
-- chargent pas depuis l'environnement d'audit. Les laisser hors de la file
-- reviendrait à les faire passer pour relus.
--
-- Ils entrent donc eux aussi en « à relire », avec une note qui dit d'où
-- vient le doute. Les fiches déjà traitées ne sont pas réécrites.

insert into public.product_media_reviews (product_id, status, note)
select p.id,
       'pending',
       'Visuels hébergés sur Supabase Storage — jamais passés en revue (ils n''ont pas pu être chargés pendant l''audit). Relire chaque vue : marque ou logo d''usine, étiquette, texte chinois.'
from public.products p
where exists (
  select 1
  from unnest(array[p.main_image_url] || coalesce(p.gallery_urls, '{}')) as u(url)
  where u.url like '%/storage/v1/object/public/%'
)
on conflict (product_id) do nothing;
