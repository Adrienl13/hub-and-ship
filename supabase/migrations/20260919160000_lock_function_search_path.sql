-- 55. Figer le search_path des trois fonctions qui n'en avaient pas.
--
-- Relevé par l'audit sécurité Supabase avant mise en ligne
-- (lint 0011_function_search_path_mutable) :
--
--   public.product_composition_is_valid(jsonb)       -- migration 53
--   public.volume_discount_families_are_valid(jsonb) -- migration 49
--   public.product_discount_family(text)             -- migration 49
--
-- Les trois sont SECURITY INVOKER, donc le risque est modéré — mais les deux
-- premières sont appelées depuis une CONTRAINTE CHECK. Une contrainte est
-- évaluée à chaque écriture, sous le search_path de l'appelant : un rôle qui
-- place devant `public` un schéma à lui, contenant une fonction de même nom
-- et de même signature, fait valider ses écritures par SA fonction. La
-- contrainte continue de passer, et n'empêche plus rien.
--
-- `set search_path` fige la résolution au moment de la définition. Aucun
-- corps de fonction n'est réécrit : seul l'attribut change, donc les
-- contraintes qui en dépendent ne sont ni revalidées ni reconstruites.
--
-- pg_temp est listé en dernier, et jamais en premier : c'est la règle pour
-- qu'un schéma temporaire créé par l'appelant ne puisse pas devancer public.

alter function public.product_composition_is_valid(jsonb)
  set search_path = public, pg_temp;

alter function public.volume_discount_families_are_valid(jsonb)
  set search_path = public, pg_temp;

alter function public.product_discount_family(text)
  set search_path = public, pg_temp;

-- Garde-fou : les trois portent bien un search_path figé.
do $check$
declare
  v_manquantes text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into v_manquantes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'product_composition_is_valid',
      'volume_discount_families_are_valid',
      'product_discount_family'
    )
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
      where cfg like 'search_path=%'
    );

  if v_manquantes is not null then
    raise exception 'search_path toujours mutable sur : %', v_manquantes;
  end if;
end $check$;
