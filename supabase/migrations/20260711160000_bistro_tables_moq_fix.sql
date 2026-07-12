-- MOQ des tables bistrot incohérent (audit global M10).
--
-- 7 tables de la collection bistrot affichaient un MOQ de 50 (valeur des
-- chaises) alors que toutes les autres tables du catalogue sont à 20 — badge
-- « série » incohérent d'une table à l'autre. On aligne moq_units à 20 et on
-- corrige la mention « MOQ 50 » dans les descriptions. Purement cosmétique :
-- la règle de quantité au checkout (min 50 uniquement pour les chaises) n'est
-- pas touchée, donc aucun impact monétaire.

update public.products
set moq_units = 20,
    description = replace(description, 'MOQ 50 unités', 'MOQ 20 unités')
where sku in ('BIS-031', 'BIS-032', 'BIS-033', 'BIS-034', 'BIS-036', 'BIS-038', 'BIS-042')
  and category = 'table'
  and moq_units = 50;
