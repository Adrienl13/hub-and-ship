-- 47. Le taux de TVA d'une réservation ne vient plus du client.
--
-- create_reservation_with_items() est grantée à `anon` et lisait son taux
-- dans le payload, à DEUX endroits :
--
--   v_vat_rate := coalesce((v_reservation ->> 'vat_rate')::numeric, 20.00);
--   ... insert into reservations (..., vat_rate, ...) values (
--         ..., coalesce((v_reservation ->> 'vat_rate')::numeric, 20.00), ...)
--
-- Le contrôle d'entête vérifie pourtant tout le reste au centime près
-- (volume_discount, total_ht, vat_amount, total_ttc, reservation_fee,
-- deposit_amount, pay_at_80_percent, balance_amount, tolérance 0,05 €).
-- Mais le taux n'est pas un montant CONTRÔLÉ : c'est une ENTRÉE du calcul.
-- Un appel forgé avec « vat_rate: 0 » produit donc v_vat = 0, le client
-- envoie vat_amount = 0 et total_ttc = net, et tous les contrôles passent :
-- la réservation est persistée avec 0 € de TVA, sans la moindre erreur.
--
-- Aucun code client n'envoie ce champ (vérifié : src/ ne le produit nulle
-- part, il n'est lu que sur les factures) et le site n'a qu'un seul taux,
-- 20 %. Le payload n'a donc jamais rien à dire ici.
--
-- Sans effet tant que le tunnel s'arrête au devis (aucun encaissement), mais
-- c'est exactement le genre de trou qu'on ne veut pas découvrir le jour où
-- Stripe s'ouvre : les montants sont alors déjà en base.
--
-- POURQUOI UNE SUBSTITUTION ET PAS UN `create or replace` COMPLET :
-- l'historique local et l'historique distant divergent. Réécrire ici la
-- version du dépôt écraserait silencieusement ce qui tourne réellement en
-- production. On prend donc la définition VIVANTE, on n'y change que ces
-- deux expressions, et on la rejoue. Idempotent : rejouer ne fait rien.

do $mig$
declare
  v_def text;
  v_patched text;
  -- L'expression est identique aux deux endroits : un seul motif suffit,
  -- mais les remplacements diffèrent (variable vs valeur insérée).
  v_calc_old constant text :=
    'v_vat_rate := coalesce((v_reservation ->> ''vat_rate'')::numeric, 20.00);';
  v_calc_new constant text :=
    'v_vat_rate := 20.00; -- taux serveur : jamais repris du payload client';
  v_insert_old constant text :=
    'coalesce((v_reservation ->> ''vat_rate'')::numeric, 20.00),';
  v_insert_new constant text := 'v_vat_rate,';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_reservation_with_items';

  if v_def is null then
    raise exception 'create_reservation_with_items introuvable';
  end if;

  if position('''vat_rate''' in v_def) = 0 then
    return; -- déjà corrigé
  end if;

  if position(v_calc_old in v_def) = 0 then
    raise exception
      'ligne de calcul TVA introuvable : la fonction a changé, corriger cette migration';
  end if;

  -- Le calcul d'abord (motif le plus long), l'insertion ensuite.
  v_patched := replace(v_def, v_calc_old, v_calc_new);
  v_patched := replace(v_patched, v_insert_old, v_insert_new);

  if position('''vat_rate''' in v_patched) > 0 then
    raise exception
      'une lecture de vat_rate subsiste après substitution : corriger cette migration';
  end if;

  execute v_patched;
end $mig$;

-- Garde-fou : après exécution, la fonction ne lit plus le champ nulle part.
do $check$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_reservation_with_items'
      and position('''vat_rate''' in pg_get_functiondef(p.oid)) > 0
  ) then
    raise exception 'le taux de TVA vient encore du payload';
  end if;
end $check$;
