-- 44. Revue des photos produit : un marqueur par fiche dans l'espace admin.
--
-- Les visuels des séries fournisseur ont été versés en lot. La très grande
-- majorité est propre, mais quelques vues portent encore un élément de
-- marque (chevalet d'usine, étiquette, fiche technique en chinois). Ce tri
-- relève d'un œil humain, pas d'un script : cette table sert de pense-bête
-- pour le parcourir fiche par fiche, sans jamais toucher aux images.
--
--   pending  le lot n'a pas encore été relu
--   fix      une vue au moins doit être remplacée ou retirée
--   ok       relu, rien à signaler
--
-- Table séparée, volontairement : `products` est soumise à des grants
-- colonne par colonne (migrations 37 et 38) et alimente la vue publique
-- products_public. Un statut de relecture interne n'a rien à y faire.
--
-- Aucune photo n'est ajoutée, modifiée ni supprimée ici.

create table if not exists public.product_media_reviews (
  product_id text primary key
    references public.products(id) on delete cascade,
  status text not null default 'pending',
  note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_at timestamptz not null default now(),
  constraint product_media_reviews_status_check
    check (status in ('pending', 'fix', 'ok'))
);

comment on table public.product_media_reviews is
  'Suivi de la relecture des photos produit (recherche d''éléments de marque fournisseur). Interne : jamais exposé au catalogue public.';

create index if not exists product_media_reviews_status_idx
  on public.product_media_reviews (status);

alter table public.product_media_reviews enable row level security;

drop policy if exists "media reviews admin all" on public.product_media_reviews;
create policy "media reviews admin all"
  on public.product_media_reviews
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.product_media_reviews from anon;
grant select, insert, update, delete on public.product_media_reviews to authenticated;

-- Amorçage : une ligne « à relire » pour chaque fiche dont au moins une vue
-- vient d'un lot fournisseur. Les fiches déjà relues ne sont pas réécrites.
insert into public.product_media_reviews (product_id, status, note)
select p.id,
       'pending',
       'Lot fournisseur ' ||
       string_agg(distinct
         case
           when u.url like '/catalogue/bistro-seating%' then '« bistro-seating »'
           when u.url like '/catalogue/rope-series%' then '« rope-series »'
           when u.url like '/catalogue/teslin-series%' then '« teslin-series »'
           when u.url like '/catalogue/table-base-series%' then '« table-base-series »'
           else '« autre »'
         end, ' + ')
       || ' — relire chaque vue : chevalet ou logo d''usine, étiquette, texte chinois, fiche technique.'
from public.products p
join lateral unnest(array[p.main_image_url] || coalesce(p.gallery_urls, '{}')) as u(url)
  on u.url like '/catalogue/%'
group by p.id
on conflict (product_id) do nothing;

-- Trois cas déjà identifiés pendant l'audit du 17 septembre 2026.
insert into public.product_media_reviews (product_id, status, note)
select p.id, 'fix',
       'Quatre vues de la galerie pointent vers des fichiers retirés du dépôt (marque d''usine lisible au premier plan) : BIS-044-02 à BIS-044-05. Retirer ces URL de la galerie.'
from public.products p
where p.sku = 'BIS-044'
on conflict (product_id) do update
  set status = 'fix', note = excluded.note, updated_at = now()
  where product_media_reviews.status <> 'ok';

insert into public.product_media_reviews (product_id, status, note)
select p.id, 'fix',
       'La vue TES-015-06 est une fiche technique rédigée en chinois, affichée sur une fiche active. À retirer ou à remplacer.'
from public.products p
where p.sku = 'TES-015'
on conflict (product_id) do update
  set status = 'fix', note = excluded.note, updated_at = now()
  where product_media_reviews.status <> 'ok';

insert into public.product_media_reviews (product_id, status, note)
select p.id, 'fix',
       'Photo d''illustration générique (banque d''images Unsplash), pas le produit. À remplacer avant toute réactivation de la fiche.'
from public.products p
where exists (
  select 1
  from unnest(array[p.main_image_url] || coalesce(p.gallery_urls, '{}')) as u(url)
  where u.url like '%images.unsplash.com%'
)
on conflict (product_id) do update
  set status = 'fix', note = excluded.note, updated_at = now()
  where product_media_reviews.status <> 'ok';
