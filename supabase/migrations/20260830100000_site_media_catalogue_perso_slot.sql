-- 29 — slot média « catalogue-perso » (fenêtre Personnalisation incluse de
-- la refonte catalogue v3). La contrainte de site_media n'acceptait pas le
-- nouveau slot : l'upload depuis l'admin aurait échoué. Déjà appliquée en
-- prod (sans effet tant que la v3 n'est pas déployée).
alter table public.site_media drop constraint site_media_slot_check;
alter table public.site_media add constraint site_media_slot_check
  check (slot = any (array[
    'hero', 'collections', 'clientele-band', 'prix-hero', 'catalogue-perso',
    'trajet-1', 'trajet-2', 'trajet-3', 'trajet-4'
  ]::text[]));
