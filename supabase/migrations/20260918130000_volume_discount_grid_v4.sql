-- 50. La grille de remise volume par famille, validée le 18/09/2026.
--
--   assises  100 pièces → −6 %,  150 → −10 %   (inchangé)
--   tables    80 pièces → −5 %,  160 →  −8 %   (40 puis 80 tables complètes)
--   salons    10 pièces → −6 %,   20 → −10 %
--   autres   100 pièces → −6 %,  150 → −10 %   (grille historique)
--
-- POURQUOI CES SEUILS-LÀ, au vu du catalogue actif :
--
--   assises : 103 fiches, MOQ médian 50, prix médian 79 €. Le palier 1 exige
--     donc deux références, le palier 2 en exige trois. Grille bien calibrée,
--     on n'y touche pas.
--   tables  : 18 fiches, MOQ médian 20, prix médian 69 €. Une table complète
--     au MOQ, c'est déjà 40 pièces (20 plateaux + 20 piètements) : le premier
--     palier demande le double. Les tables sont comptées EN PIÈCES — un
--     plateau compte 1, un piètement compte 1 — comme partout ailleurs sur le
--     site (MOQ, remplissage container, compteurs).
--   salons  : 15 fiches, prix médian 1 225 €, et surtout MOQ de 10 sur 12
--     fiches sur 15. La plus petite commande possible sur une seule référence
--     pèse donc 10 040 à 22 440 € — et ne déclenchait AUCUNE remise, quand
--     100 chaises (7 900 €) en déclenchaient une. Le palier 1 est placé au
--     MOQ, le palier 2 au double.
--
-- Chaque point de remise coûte 1 % du prix de vente, soit environ 2 % de la
-- marge (prix = coût rendu × 1,90 → 47,4 % de marge à plein tarif, 41,5 % à
-- −10 %). Le plafond technique reste 25 % : au-delà, un client direct
-- passerait sous le prix revendeur.
--
-- Nouvelle VERSION de paramètres plutôt qu'une modification sur place :
-- l'historique pricing est immuable, et l'admin peut restaurer la v3.

do $mig$
declare
  v_active public.pricing_parameters%rowtype;
  v_next_version int;
  c_grid constant jsonb := jsonb_build_object(
    'assises', jsonb_build_array(
      jsonb_build_object('min_units', 100, 'discount', 0.06),
      jsonb_build_object('min_units', 150, 'discount', 0.10)
    ),
    'tables', jsonb_build_array(
      jsonb_build_object('min_units', 80, 'discount', 0.05),
      jsonb_build_object('min_units', 160, 'discount', 0.08)
    ),
    'salons', jsonb_build_array(
      jsonb_build_object('min_units', 10, 'discount', 0.06),
      jsonb_build_object('min_units', 20, 'discount', 0.10)
    ),
    'autres', jsonb_build_array(
      jsonb_build_object('min_units', 100, 'discount', 0.06),
      jsonb_build_object('min_units', 150, 'discount', 0.10)
    )
  );
begin
  select * into v_active
  from public.pricing_parameters
  where is_active
  order by effective_from desc
  limit 1;

  if v_active.id is null then
    raise exception 'aucune version de paramètres active';
  end if;

  if v_active.volume_discount_families is not null then
    return; -- déjà posée (ou modifiée depuis l'admin) : on ne recouvre rien
  end if;

  -- Garde-fou : la grille passe la même validation que la contrainte de table,
  -- pour échouer ici avec un message clair plutôt qu'au moment de l'insert.
  if not public.volume_discount_families_are_valid(c_grid) then
    raise exception 'grille invalide';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.pricing_parameters;

  update public.pricing_parameters set is_active = false where id = v_active.id;

  v_active.id := extensions.gen_random_uuid();
  v_active.version := v_next_version;
  v_active.label := 'v' || v_next_version || ' — remises volume par famille';
  v_active.is_active := true;
  v_active.effective_from := now();
  v_active.created_at := now();
  v_active.updated_at := now();
  v_active.created_by := null;
  v_active.volume_discount_families := c_grid;

  insert into public.pricing_parameters values (v_active.*);
end $mig$;

do $check$
declare
  v_grid jsonb;
begin
  select volume_discount_families into v_grid
  from public.pricing_parameters
  where is_active
  order by effective_from desc
  limit 1;

  if v_grid is null then
    raise exception 'la grille n''a pas été posée';
  end if;
  if (v_grid -> 'salons' -> 0 ->> 'min_units')::int <> 10 then
    raise exception 'le palier salons n''est pas celui validé';
  end if;
end $check$;
