-- 57. Fiche client complète : établissement, téléphone, consentement et
-- dernière connexion vivent dans la base, pas seulement dans l'authentification.
--
-- Audit du 23/09/2026 : la table companies était vide, le nom d'établissement
-- saisi à l'inscription restait dans auth.users.raw_user_meta_data, le
-- téléphone n'était recopié dans users_profile pour aucun compte, et la
-- colonne users_profile.last_login_at (affichée dans l'admin) n'était jamais
-- écrite. Aucune fiche client 360° possible, tarif par canal inapplicable.
--
-- Quatre gestes, tous additifs :
--   1. handle_new_user recopie aussi téléphone et consentement marketing, et
--      crée l'établissement (companies) quand l'inscription l'a donné ;
--   2. un seul déclencheur à la création (le doublon on_auth_user_created
--      appelait deux fois la même fonction) ;
--   3. set_my_company(nom) : l'utilisateur connecté crée ou renomme SON
--      établissement (la table companies reste interdite en écriture directe
--      aux acheteurs : canal, SIRET vérifié et risque restent des décisions
--      admin) ;
--   4. last_login_at suit auth.users.last_sign_in_at ;
-- puis un rattrapage des comptes existants.

-- 1. Création de compte : fiche + établissement depuis les métadonnées -------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_name text := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  v_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  v_consent boolean := coalesce((new.raw_user_meta_data ->> 'email_marketing_consent')::boolean, false);
  v_company_id uuid;
begin
  begin
    if v_company_name is not null then
      insert into public.companies (legal_name, trading_name)
      values (v_company_name, v_company_name)
      returning id into v_company_id;
    end if;

    insert into public.users_profile (
      id, email, first_name, last_name, phone, company_id,
      email_marketing_consent, email_marketing_consent_at
    )
    values (
      new.id,
      coalesce(new.email, ''),
      nullif(new.raw_user_meta_data ->> 'first_name', ''),
      nullif(new.raw_user_meta_data ->> 'last_name', ''),
      v_phone,
      v_company_id,
      v_consent,
      case when v_consent then now() else null end
    )
    on conflict (id) do update
      set email = excluded.email,
          phone = coalesce(public.users_profile.phone, excluded.phone),
          company_id = coalesce(public.users_profile.company_id, excluded.company_id),
          updated_at = now();
  exception when unique_violation then
    -- lower(email) déjà pris par un autre profil : on ne bloque pas
    -- l'inscription, le rattachement se fera à la main (email recyclé).
    null;
  end;
  return new;
end;
$$;

-- 2. Un seul déclencheur à la création ---------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
-- on_auth_user_created_profile reste (même fonction, même moment).

-- 3. L'utilisateur crée ou renomme son établissement ------------------------

create or replace function public.set_my_company(p_legal_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(trim(p_legal_name), '');
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'company_name_required' using errcode = '22023';
  end if;

  select company_id into v_company_id
  from public.users_profile
  where id = v_uid;

  if v_company_id is null then
    insert into public.companies (legal_name, trading_name)
    values (v_name, v_name)
    returning id into v_company_id;

    update public.users_profile
    set company_id = v_company_id, updated_at = now()
    where id = v_uid;
  else
    -- Renommage par le client : le nom commercial suit ; la raison sociale
    -- ne bouge plus une fois le SIRET vérifié par l'admin.
    update public.companies
    set trading_name = v_name,
        legal_name = case when siret_verified then legal_name else v_name end,
        updated_at = now()
    where id = v_company_id;
  end if;

  return v_company_id;
end;
$$;

revoke execute on function public.set_my_company(text) from public, anon;
grant execute on function public.set_my_company(text) to authenticated;

-- 4. Dernière connexion ------------------------------------------------------

create or replace function public.handle_user_signed_in()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.users_profile
    set last_login_at = new.last_sign_in_at
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_signed_in();

-- 5. Rattrapage des comptes existants ----------------------------------------

-- Dernière connexion connue.
update public.users_profile p
set last_login_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and u.last_sign_in_at is not null
  and (p.last_login_at is null or p.last_login_at < u.last_sign_in_at);

-- Téléphone saisi à l'inscription mais jamais recopié.
update public.users_profile p
set phone = nullif(trim(u.raw_user_meta_data ->> 'phone'), ''),
    updated_at = now()
from auth.users u
where u.id = p.id
  and p.phone is null
  and nullif(trim(u.raw_user_meta_data ->> 'phone'), '') is not null;

-- Établissement saisi (métadonnées) sans ligne companies.
do $$
declare
  r record;
  v_company_id uuid;
begin
  for r in
    select u.id, nullif(trim(u.raw_user_meta_data ->> 'company_name'), '') as company_name
    from auth.users u
    join public.users_profile p on p.id = u.id
    where p.company_id is null
      and nullif(trim(u.raw_user_meta_data ->> 'company_name'), '') is not null
  loop
    insert into public.companies (legal_name, trading_name)
    values (r.company_name, r.company_name)
    returning id into v_company_id;

    update public.users_profile
    set company_id = v_company_id, updated_at = now()
    where id = r.id;
  end loop;
end $$;
