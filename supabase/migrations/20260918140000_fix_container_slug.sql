-- 51. CC-2025-014 était servi sous l'URL /livres/cc-2025-002.
--
-- La fiche annonce « CC-2025-014 » dans son titre et son corps, mais son slug
-- désignait une autre référence. Depuis que /livres est indexable, c'est cette
-- URL-là que Google enregistre : un registre de preuve dont l'adresse
-- contredit la pièce qu'elle porte.
--
-- Aucun autre container ne porte cc-2025-014 (les trois autres sont
-- cc-2025-003, cc-2025-004 et cc-2026-001), et aucune réservation ni aucun
-- lien public ne référence l'ancien slug — /livres vient tout juste de devenir
-- indexable. Ne touche que le slug : ni les compteurs, ni les photos, ni les
-- dates. Rejouable sans effet.
update public.containers
set slug = 'cc-2025-014'
where reference = 'CC-2025-014'
  and slug = 'cc-2025-002';

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from public.containers
  where slug is not null
    and lower(replace(reference, ' ', '')) <> lower(slug);

  if v_bad > 0 then
    raise exception 'slug ne correspondant pas à la référence : %', v_bad;
  end if;
end $$;
