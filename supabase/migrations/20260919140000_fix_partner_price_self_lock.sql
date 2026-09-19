-- 54. Un prix net partenaire périmé ne doit plus s'auto-verrouiller.
--
-- Symptôme (ROP-050, 19/09) : impossible d'enregistrer la fiche après avoir
-- porté le FOB de 48 à 99 USD. « Échec de l'enregistrement : get_price:
-- partner override below minimum margin floor for product rope-rop-050 »,
-- alors que le prix saisi à l'écran (140,73 €) est PARFAITEMENT au-dessus du
-- plancher.
--
-- Enchaînement :
--
--   FOB 48 USD → coût rendu  52,69 € → plancher  60,59 €   (état ancien)
--   FOB 99 USD → coût rendu 100,55 € → plancher 115,63 €   (état saisi)
--
-- `product_partner_prices` portait 73,68 €, légitime sous l'ancien plancher.
-- Le nouveau FOB fait passer le plancher à 115,63 € : les 73,68 € stockés
-- deviennent non conformes. C'est exactement ce que l'admin est en train de
-- corriger — il remplace 73,68 par 140,73.
--
-- Sauf que le trigger BEFORE `enforce_product_partner_price_floor` :
--
--   1. vérifie `new.net_price_ht` (140,73) contre le plancher → CONFORME ;
--   2. puis, si `formula_price_ht` est vide, appelle `get_price()` pour le
--      remplir — et `get_price` relit `product_partner_prices`, où, le
--      trigger étant BEFORE, la ligne vaut encore 73,68 €. Il lève.
--
-- La mise à jour qui répare la donnée est donc refusée PAR la donnée qu'elle
-- répare. Aucune sortie par l'interface : chaque tentative rejoue le même
-- refus. La fiche est gelée.
--
-- L'appel à `get_price` n'est pas un garde-fou, c'est un enrichissement :
-- il ne sert qu'à renseigner `formula_price_ht` à titre indicatif. Le vrai
-- contrôle est l'étape 1, qui a déjà validé la valeur ENTRANTE. On isole
-- donc l'enrichissement : s'il échoue, `formula_price_ht` reste vide — il
-- est de toute façon rempli au prochain reprice — et l'écriture passe.
--
-- Le plancher n'est pas assoupli d'un centime : un prix net sous le coût
-- rendu + marge minimale reste refusé, par l'étape 1, avec son message.
--
-- Même esprit que le garde déjà posé juste au-dessus (« ne jamais rappeler
-- get_price ici pour un produit inactif ») : cet appel ne doit jamais
-- décider du sort de l'écriture.
--
-- Substitution ciblée de la définition VIVANTE, pas un `create or replace`
-- repris du dépôt : l'historique local et l'historique distant divergent.
-- Idempotent : rejouer ne fait rien.

do $mig$
declare
  v_def text;
  v_patched text;
  v_old constant text :=
    E'    new.formula_price_ht := (\n'
    || E'      select formula_price_ht\n'
    || E'      from public.get_price(\n'
    || E'        new.product_id,\n'
    || E'        ''reseller''::public.pricing_channel,\n'
    || E'        1,\n'
    || E'        new.partner_application_id,\n'
    || E'        now()\n'
    || E'      )\n'
    || E'    );\n';
  v_new constant text :=
    E'    -- Enrichissement, jamais un garde-fou : le plancher a déjà été\n'
    || E'    -- vérifié sur new.net_price_ht. get_price relit la ligne AVANT\n'
    || E'    -- mise à jour (trigger BEFORE) et lèverait sur un prix périmé,\n'
    || E'    -- bloquant l''écriture même qui le remplace (migration 54).\n'
    || E'    begin\n'
    || E'      new.formula_price_ht := (\n'
    || E'        select formula_price_ht\n'
    || E'        from public.get_price(\n'
    || E'          new.product_id,\n'
    || E'          ''reseller''::public.pricing_channel,\n'
    || E'          1,\n'
    || E'          new.partner_application_id,\n'
    || E'          now()\n'
    || E'        )\n'
    || E'      );\n'
    || E'    exception when others then\n'
    || E'      new.formula_price_ht := null; -- rempli au prochain reprice\n'
    || E'    end;\n';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_product_partner_price_floor';

  if v_def is null then
    raise exception 'enforce_product_partner_price_floor introuvable';
  end if;

  if position('rempli au prochain reprice' in v_def) > 0 then
    return; -- déjà appliqué
  end if;

  if position(v_old in v_def) = 0 then
    raise exception
      'enforce_product_partner_price_floor a changé : ancrage introuvable, corriger cette migration';
  end if;

  v_patched := replace(v_def, v_old, v_new);
  execute v_patched;
end $mig$;

-- Garde-fou : l'enrichissement est isolé, le plancher est toujours là.
do $check$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'enforce_product_partner_price_floor';

  if position('exception when others then' in v_def) = 0 then
    raise exception 'l''appel à get_price n''a pas été isolé';
  end if;
  -- Le contrôle de plancher sur la valeur entrante doit être intact.
  if position('new.net_price_ht < v_floor' in v_def) = 0 then
    raise exception 'le plancher de marge a disparu du trigger';
  end if;
  if position('below minimum floor' in v_def) = 0 then
    raise exception 'le message de refus du plancher a disparu';
  end if;
end $check$;
