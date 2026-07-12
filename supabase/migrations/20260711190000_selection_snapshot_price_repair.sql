-- Assainissement rétroactif des snapshots de sélections partenaires (M11).
--
-- Avant le correctif client (buildSelectionItemInput fige désormais le prix
-- PUBLIC), un revendeur connecté qui sauvait une sélection y figeait son prix
-- NET canalisé : product_snapshot.basePriceHt était servi en clair aux
-- anonymes sur /p/{slug} et sur le devis co-brandé. Le fix client ne répare
-- pas les lignes déjà persistées — on retamponne ici TOUS les snapshots au
-- prix public courant (products.base_price_ht, la seule source publique).
--
-- Idempotent : re-jouer réécrit la même valeur. Les items dont le produit
-- n'existe plus (product_id hors catalogue) sont laissés tels quels — ils ne
-- peuvent pas fuiter un prix plus juste que celui qu'on aurait aujourd'hui.

update public.partner_selection_items psi
set product_snapshot = jsonb_set(
      psi.product_snapshot,
      '{basePriceHt}',
      to_jsonb(p.base_price_ht)
    )
from public.products p
where p.id::text = psi.product_id
  and p.base_price_ht is not null
  and psi.product_snapshot ? 'basePriceHt'
  and (psi.product_snapshot -> 'basePriceHt') is distinct from to_jsonb(p.base_price_ht);
