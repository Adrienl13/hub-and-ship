-- Migration 33a — nouvelles catégories produit.
--
-- Décision 09/2026 : les tables se composent en deux temps (piètement puis
-- plateau) et les salons / ensembles lounge ne sont pas des bancs.
--   table_base : piètement de table (vendu seul ou composé avec un plateau)
--   table_top  : plateau de table (certains coloris imposent un minimum de
--                commande propre — voir product_variants.min_order_units)
--   lounge     : salon, canapé, ensemble lounge
-- « table » reste la table complète / l'ensemble repas.
--
-- Les valeurs d'un enum ne sont utilisables qu'une fois la transaction
-- validée : les colonnes et la RPC arrivent dans la migration suivante.

alter type public.product_category add value if not exists 'table_base';
alter type public.product_category add value if not exists 'table_top';
alter type public.product_category add value if not exists 'lounge';
