-- ============================================================
-- Container Club / Hub & Ship — Row Level Security
-- ============================================================

-- ----------------------------------------------------------------
-- Activer RLS sur toutes les tables
-- ----------------------------------------------------------------
alter table professionals                  enable row level security;
alter table products                       enable row level security;
alter table product_variants               enable row level security;
alter table containers                     enable row level security;
alter table container_seed_commitments     enable row level security;
alter table container_reservations         enable row level security;
alter table container_reservation_items    enable row level security;

-- ----------------------------------------------------------------
-- products : lecture publique (anon + authenticated), pas d'écriture côté client
-- ----------------------------------------------------------------
create policy "products are public"
on products for select
to anon, authenticated
using (is_active);

-- ----------------------------------------------------------------
-- product_variants : lecture publique
-- ----------------------------------------------------------------
create policy "variants are public"
on product_variants for select
to anon, authenticated
using (
  exists (
    select 1 from products p
    where p.id = product_variants.product_id and p.is_active
  )
);

-- ----------------------------------------------------------------
-- containers : lecture publique (catalogue + historique)
-- ----------------------------------------------------------------
create policy "containers are public"
on containers for select
to anon, authenticated
using (true);

-- ----------------------------------------------------------------
-- container_seed_commitments : lecture publique, écriture admin uniquement
-- (non sensible, sert juste à afficher des compteurs d'amorçage)
-- ----------------------------------------------------------------
create policy "seed commitments are public"
on container_seed_commitments for select
to anon, authenticated
using (true);

-- ----------------------------------------------------------------
-- professionals : un pro voit/modifie uniquement sa propre fiche
-- INSERT : autorise la création initiale après signup (id = auth.uid())
-- ----------------------------------------------------------------
create policy "professionals select own"
on professionals for select
to authenticated
using (id = auth.uid());

create policy "professionals insert own"
on professionals for insert
to authenticated
with check (id = auth.uid());

create policy "professionals update own"
on professionals for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ----------------------------------------------------------------
-- container_reservations : un pro voit/crée uniquement ses propres résas
-- Modification limitée tant que paiement non confirmé
-- ----------------------------------------------------------------
create policy "reservations select own"
on container_reservations for select
to authenticated
using (professional_id = auth.uid());

create policy "reservations insert own"
on container_reservations for insert
to authenticated
with check (
  professional_id = auth.uid()
  and exists (
    select 1 from containers c
    where c.id = container_id and c.status = 'open'
  )
);

create policy "reservations update own pending"
on container_reservations for update
to authenticated
using (
  professional_id = auth.uid()
  and status = 'pending_payment'
)
with check (professional_id = auth.uid());

-- ----------------------------------------------------------------
-- container_reservation_items : accès via la résa parente
-- ----------------------------------------------------------------
create policy "reservation items select own"
on container_reservation_items for select
to authenticated
using (
  exists (
    select 1 from container_reservations r
    where r.id = reservation_id and r.professional_id = auth.uid()
  )
);

create policy "reservation items insert own pending"
on container_reservation_items for insert
to authenticated
with check (
  exists (
    select 1 from container_reservations r
    where r.id = reservation_id
      and r.professional_id = auth.uid()
      and r.status = 'pending_payment'
  )
);

create policy "reservation items delete own pending"
on container_reservation_items for delete
to authenticated
using (
  exists (
    select 1 from container_reservations r
    where r.id = reservation_id
      and r.professional_id = auth.uid()
      and r.status = 'pending_payment'
  )
);

-- ----------------------------------------------------------------
-- Vue agrégée des engagements : accessible à tous (chiffres globaux,
-- aucune info nominative)
-- ----------------------------------------------------------------
grant select on container_variant_commitments to anon, authenticated;
