-- 48. Total HT et TVA = somme stricte des lignes, côté serveur aussi.
--
-- Le devis affiche désormais, produit par produit, le PU TTC et le total TTC
-- de la ligne. Deux façons d'obtenir le pied de page :
--
--   (a) pourcentage sur le total   : vat = round(net_total × 20 %)
--   (b) somme des lignes           : vat = Σ round(ligne_nette × 20 %)
--
-- Elles ne donnent pas le même centime. Mesuré sur des paniers réels : 0,01 €
-- à 12 lignes remisées −6 %, 0,02 € à 20 lignes remisées −10 %. Le client
-- calculait (b) — c'est ce que l'acheteur additionne des yeux — et le serveur
-- (a). L'écart est absorbé pour l'instant par la tolérance de 0,05 € du
-- contrôle d'entête, mais il CROÎT avec le nombre de lignes : au-delà d'une
-- dizaine de lignes remisées, une réservation parfaitement légitime se fait
-- refuser au dernier clic avec « derived monetary fields are inconsistent ».
-- On ne veut pas dépendre d'une tolérance : on veut le même calcul des deux
-- côtés.
--
-- Le serveur passe donc lui aussi à (b), pour le total HT ET pour la TVA :
--
--   ligne_nette_i = round(ligne_brute_i × (1 − taux_remise), 2)
--   total_ht      = Σ ligne_nette_i
--   tva           = Σ round(ligne_nette_i × 20 %, 2)
--   remise        = sous_total_brut − total_ht
--
-- Le sous-total brut reste la somme des lignes brutes (inchangé), et la remise
-- devient une DIFFÉRENCE de sommes plutôt qu'un pourcentage — donc le trio
-- sous-total / remise / total HT retombe toujours juste à l'affichage.
--
-- Le taux de remise n'est connu qu'APRÈS la boucle d'articles (il dépend du
-- nombre total d'unités) : on mémorise les sous-totaux de ligne dans un
-- tableau pendant la boucle, et on repasse dessus une fois le palier connu.
--
-- Substitution ciblée et non `create or replace` complet : l'historique local
-- et l'historique distant divergent, réécrire ici la version du dépôt
-- écraserait ce qui tourne réellement. Idempotent : rejouer ne fait rien.

do $mig$
declare
  v_def text;
  v_patched text;
  v_decl_old constant text := '  v_volume_rate numeric := 0;';
  v_decl_new constant text :=
    '  v_volume_rate numeric := 0;'
    || E'\n  -- sous-totaux de ligne conservés pour la somme stricte (migration 48)'
    || E'\n  v_line_subtotals numeric[] := ''{}'';'
    || E'\n  v_line_net numeric;';
  v_accum_old constant text :=
    '    v_subtotal_sum := v_subtotal_sum + v_line_subtotal;';
  v_accum_new constant text :=
    '    v_subtotal_sum := v_subtotal_sum + v_line_subtotal;'
    || E'\n    v_line_subtotals := v_line_subtotals || v_line_subtotal;';
  v_net_old constant text :=
    '  v_net_subtotal := round(v_subtotal_sum * (1 - v_volume_rate), 2);';
  v_net_new constant text :=
    '  -- Total HT = somme des lignes remisées, pas un pourcentage du sous-total.'
    || E'\n  v_net_subtotal := 0;'
    || E'\n  foreach v_line_net in array v_line_subtotals loop'
    || E'\n    v_net_subtotal := v_net_subtotal + round(v_line_net * (1 - v_volume_rate), 2);'
    || E'\n  end loop;';
  v_vat_old constant text :=
    '  v_vat := round(v_net_subtotal * v_vat_rate / 100, 2);';
  v_vat_new constant text :=
    '  -- TVA = somme des TVA de ligne, arrondies une par une (idem client).'
    || E'\n  v_vat := 0;'
    || E'\n  foreach v_line_net in array v_line_subtotals loop'
    || E'\n    v_vat := v_vat + round(round(v_line_net * (1 - v_volume_rate), 2) * v_vat_rate / 100, 2);'
    || E'\n  end loop;';
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

  if position('v_line_subtotals' in v_def) > 0 then
    return; -- déjà appliqué
  end if;

  -- Les quatre points d'ancrage doivent exister TOUS LES QUATRE : appliquer la
  -- moitié du correctif donnerait une fonction qui ne compile pas, ou pire,
  -- qui compile en calculant faux.
  if position(v_decl_old in v_def) = 0
    or position(v_accum_old in v_def) = 0
    or position(v_net_old in v_def) = 0
    or position(v_vat_old in v_def) = 0 then
    raise exception
      'create_reservation_with_items a changé : points d''ancrage introuvables, corriger cette migration';
  end if;

  v_patched := replace(v_def, v_decl_old, v_decl_new);
  v_patched := replace(v_patched, v_accum_old, v_accum_new);
  v_patched := replace(v_patched, v_net_old, v_net_new);
  v_patched := replace(v_patched, v_vat_old, v_vat_new);

  execute v_patched;
end $mig$;

-- Garde-fou : plus aucun total dérivé d'un pourcentage appliqué au sous-total.
do $check$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_reservation_with_items';

  if position('v_line_subtotals' in v_def) = 0 then
    raise exception 'la somme stricte des lignes n''a pas été posée';
  end if;
  if position('round(v_net_subtotal * v_vat_rate' in v_def) > 0 then
    raise exception 'la TVA est encore calculée sur le total';
  end if;
  if position('round(v_subtotal_sum * (1 - v_volume_rate)' in v_def) > 0 then
    raise exception 'le total HT est encore calculé sur le sous-total';
  end if;
end $check$;
