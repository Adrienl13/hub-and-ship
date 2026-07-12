-- Réparation de la chaîne d'identité utilisateur (audit global M14).
--
-- La migration 20260520101823_rattrapage_schema a REMPLACÉ le trigger unique
-- on_auth_user_created (qui alimentait users_profile via handle_new_user) par
-- handle_new_professional (qui n'écrit QUE dans `professionals`). Depuis,
-- AUCUNE ligne users_profile n'est créée au signup → current_company_id()
-- retourne toujours null → tout le monde est 'direct', l'espace partenaire
-- canal/apporteur est mort.
--
-- Correctif ADDITIF (ne touche pas le trigger professionnels) : un SECOND
-- trigger qui (re)crée la ligne users_profile, + un backfill des comptes déjà
-- existants. handle_new_user() existe toujours et est idempotent (on conflict).

-- handle_new_user ne gérait que le conflit sur id ; or users_profile porte
-- aussi un index unique sur lower(email). Un email périmé resté dans un vieux
-- profil (email auth changé hors app) ferait échouer l'insert → toute
-- l'insertion auth.users annulée → signup en erreur 500. Le trigger ne doit
-- JAMAIS pouvoir casser un signup : on avale la violation d'unicité.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    -- Corps identique à la version d'origine (20260518103000).
    insert into public.users_profile (id, email, first_name, last_name)
    values (
      new.id,
      coalesce(new.email, ''),
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(new.raw_user_meta_data ->> 'last_name', '')
    )
    on conflict (id) do update
      set email = excluded.email,
          updated_at = now();
  exception when unique_violation then
    -- lower(email) déjà pris par un autre profil : on ne bloque pas le signup,
    -- le rattachement se fera manuellement (cas limite : email recyclé).
    null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill : les comptes créés depuis la rupture n'ont pas de users_profile.
-- Même précaution : on écarte les emails déjà présents (index lower(email))
-- et on dédoublonne au sein du lot (deux comptes au même email → le plus
-- ancien seulement) pour que la migration ne puisse pas avorter.
insert into public.users_profile (id, email)
select id, email from (
  select distinct on (lower(coalesce(u.email, '')))
         u.id, coalesce(u.email, '') as email
  from auth.users u
  where not exists (
    select 1 from public.users_profile p where p.id = u.id
  )
  and not exists (
    select 1 from public.users_profile p2
    where lower(p2.email) = lower(coalesce(u.email, ''))
  )
  order by lower(coalesce(u.email, '')), u.created_at asc
) candidates
on conflict (id) do nothing;
