-- Migration 34 — reclassement des produits (⚠️ À APPLIQUER APRÈS le
-- déploiement du bundle « composer ma table » : l'ancien bundle ne connaît
-- pas les catégories lounge / table_base / table_top).
--
-- Constat de l'audit pré-lancement + décision 09/2026 :
--   - les salons cordage étaient classés « banc » → lounge ;
--   - les piètements importés étaient classés « table » → table_base ;
--   - des tables classées fauteuil/banc et des chaises classées
--     fauteuil/banc (le nom fait foi) → table / chair ;
--   - les ensembles repas restent des « tables » (table complète).
-- Ciblage par SKU, idempotent.

update public.products set category = 'lounge', updated_at = now()
where sku in ('ROP-001','ROP-011','ROP-012','ROP-014','ROP-015','ROP-017','ROP-018','ROP-019')
  and category <> 'lounge';

update public.products set category = 'table_base', updated_at = now()
where sku in ('TBA-001','TBA-002','TBA-003','TBA-004','TBA-005','TBA-006','TBA-007')
  and category <> 'table_base';

update public.products set category = 'table', updated_at = now()
where sku in ('BIS-031','BIS-032','BIS-033','BIS-036','ROP-004','ROP-044','TES-007')
  and category <> 'table';

update public.products set category = 'chair', updated_at = now()
where sku in ('BIS-028','BIS-029','BIS-030','BIS-059','BIS-054','ROP-039','ROP-040','ROP-042','SKU-336')
  and category <> 'chair';
