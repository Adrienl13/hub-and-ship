-- Médias administrables de la page d'accueil (handoff design 07/2026).
--
-- Chaque « slot » est un emplacement visuel de la home :
--   - 'hero'           : slides du carrousel (0..n, ordonnées par sort_order)
--   - 'collections'    : grande photo de la section gammes (1 seule utilisée)
--   - 'clientele-band' : bandeau pleine largeur clientèle (1 seule utilisée)
--
-- Les fichiers vivent dans le bucket public existant `catalogue-images`
-- (préfixe site/) — mêmes politiques : lecture publique, écriture admin.
-- Si aucun média n'est défini pour un slot, le front retombe sur les
-- visuels par défaut embarqués dans /public/images/home.

create table if not exists public.site_media (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('hero', 'collections', 'clientele-band')),
  url text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists site_media_slot_order_idx
  on public.site_media (slot, sort_order);

alter table public.site_media enable row level security;

drop policy if exists "Public reads site media" on public.site_media;
create policy "Public reads site media"
  on public.site_media
  for select
  using (true);

drop policy if exists "Admins manage site media" on public.site_media;
create policy "Admins manage site media"
  on public.site_media
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
