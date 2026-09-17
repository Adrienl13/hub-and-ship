-- 42. Surcharges « grand compte » ramenées à la remise promise.
--
-- Règle du catalogue (docs/COMPTES_TEST.md, docs/AUDIT_RENTABILITE_2026-07.md) :
-- un compte « grand_compte » obtient d'office le pire prix direct, c'est-à-dire
-- le prix HT diminué du palier 3 (tier3_discount, 10 % aujourd'hui). Le trigger
-- « règle d'or » de la migration 20260711140000 ne couvre que « revendeur » et
-- « distributeur » : quatre surcharges grand compte saisies à la main sont
-- restées AU-DESSUS de cette remise, un grand compte payait donc plus cher que
-- la promesse commerciale.
--
-- Constaté le 17 septembre 2026 (audit pré-lancement), sur des prix HT inchangés :
--   TES-012  53,00 € → surcharge 49,00 €  (-7,5 %)  au lieu de 47,70 €
--   TES-004 178,00 € → surcharge 164,10 € (-7,8 %)  au lieu de 160,20 €
--   BIS-032 178,39 € → surcharge 163,49 € (-8,4 %)  au lieu de 160,55 €
--   ROP-040 102,00 € → surcharge  92,00 € (-9,8 %)  au lieu de  91,80 €
--
-- Cette migration ne touche AUCUN prix d'achat, aucun prix direct, aucune
-- surcharge revendeur ou distributeur, et ne crée aucune ligne : elle aligne
-- seulement les surcharges grand compte qui dépassent le plafond, en les
-- recalculant depuis le prix HT et le palier 3 actif. Rejouable sans effet.

update public.channel_price_overrides o
set unit_price_ht = round(
      p.base_price_ht * (1 - coalesce(
        (select pp.tier3_discount
           from public.pricing_parameters pp
          where pp.is_active
          order by pp.effective_from desc
          limit 1), 0.10)),
      2)
from public.products p
where p.id = o.product_id
  and o.channel = 'grand_compte'
  and o.unit_price_ht > round(
      p.base_price_ht * (1 - coalesce(
        (select pp.tier3_discount
           from public.pricing_parameters pp
          where pp.is_active
          order by pp.effective_from desc
          limit 1), 0.10)),
      2);

-- Garde-fou : après exécution, plus aucune surcharge grand compte ne doit
-- dépasser le pire prix direct.
do $$
declare
  v_left integer;
begin
  select count(*) into v_left
  from public.channel_price_overrides o
  join public.products p on p.id = o.product_id
  where o.channel = 'grand_compte'
    and o.unit_price_ht > round(p.base_price_ht * 0.9, 2) + 0.005;

  if v_left > 0 then
    raise exception 'surcharges grand compte encore au-dessus de la remise : %', v_left;
  end if;
end $$;
