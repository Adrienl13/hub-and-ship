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

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill : les comptes créés depuis la rupture n'ont pas de users_profile.
insert into public.users_profile (id, email)
select u.id, coalesce(u.email, '')
from auth.users u
where not exists (
  select 1 from public.users_profile p where p.id = u.id
)
on conflict (id) do nothing;
