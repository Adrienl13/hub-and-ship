-- Migration 31 — étape 2 de l'anonymisation des coûts (voir migration 30).
--
-- ⚠️ À APPLIQUER SEULEMENT APRÈS le déploiement du bundle qui lit la vue
-- products_public (commit « anonymisation des colonnes de coût »). Appliquée
-- avant, elle casserait le catalogue pour les visiteurs anonymes (l'ancien
-- bundle fait select('*') sur products).
--
-- Le rôle anon perd tout SELECT direct sur products : il lit la vue. Le rôle
-- authenticated conserve l'accès table-level (l'admin lit les coûts via ce
-- rôle ; les fonctions de pricing sont SECURITY DEFINER et ne sont pas
-- affectées). Reste à faire, hors lancement : déplacer les colonnes de coût
-- dans une table product_costs admin-only pour fermer aussi ce chemin aux
-- clients connectés.

revoke select on table public.products from anon;
