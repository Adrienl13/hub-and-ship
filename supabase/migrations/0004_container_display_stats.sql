-- ============================================================
-- Container Club — Champs d'affichage "social proof"
-- Pour les containers historiques (sans vraies reservations en BDD)
-- et pour le container ouvert (avant que de vrais pros s'engagent).
-- À terme : ces valeurs seront calculées à partir des vraies réservations.
-- ============================================================

alter table containers
  add column if not exists display_series_target int not null default 5,
  add column if not exists display_pros_count    int not null default 0,
  add column if not exists display_items_count   int not null default 0;

-- Container ouvert : reprise des valeurs du mock src/lib/products.ts
update containers
set display_series_target = 5,
    display_pros_count    = 12,
    display_items_count   = 0
where reference = 'CC-2026-001';

-- Containers livrés : reprise du mock PAST_CONTAINERS
update containers set display_pros_count = 8,  display_items_count = 287 where reference = 'CC-2025-014';
update containers set display_pros_count = 6,  display_items_count = 198 where reference = 'CC-2025-013';
update containers set display_pros_count = 11, display_items_count = 412 where reference = 'CC-2025-012';
