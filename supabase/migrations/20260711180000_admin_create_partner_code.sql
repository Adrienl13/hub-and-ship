-- Création des codes apporteur (audit global M13) — la chaîne apporteur était
-- coupée : personne n'insérait jamais dans partner_codes, donc aucune
-- commission ne pouvait s'accruer et l'espace apporteur restait vide.
--
-- RPC admin (security definer) déclenché à l'approbation d'une candidature :
--   1. provisionne / réutilise une `companies` pour l'apporteur (couple M14),
--   2. relie le compte du partenaire (users_profile.company_id) s'il existe,
--   3. génère un code unique et l'insère dans partner_codes.
-- Idempotent : rappelé sur la même candidature, il renvoie le code existant.

-- Unicité insensible à la casse : la résolution matchPartnerCodeId compare en
-- lowercase, donc 'DBP-13' et 'dbp-13' doivent être considérés identiques.
-- Défensif : la table est censée être vide (aucun insert applicatif avant ce
-- sprint) mais la policy admin permet des inserts manuels — on suffixe les
-- éventuels doublons case-insensitive (le plus ancien garde son code) pour
-- que la création de l'index ne puisse pas faire avorter la migration.
update public.partner_codes pc
set code = pc.code || '-' || substr(pc.id::text, 1, 4)
from (
  select id,
         row_number() over (partition by lower(code) order by created_at, id) as rn
  from public.partner_codes
) d
where d.id = pc.id and d.rn > 1;

create unique index if not exists partner_codes_code_lower_uidx
  on public.partner_codes (lower(code));

-- Lien durable candidature → société : posé par admin_create_partner_code,
-- lu par claim_partner_access pour rattacher le compte du partenaire même
-- s'il crée son compte APRÈS la génération du code (sinon l'espace /partner
-- resterait vide jusqu'à un re-clic admin).
alter table public.partner_applications
  add column if not exists company_id uuid references public.companies(id);

create or replace function public.admin_create_partner_code(
  p_application_id uuid,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_name text;
  v_contact_email text;
  v_siret text;
  v_status public.partner_application_status;
  v_user_id uuid;
  v_company_id uuid;
  v_code text;
  v_existing_code text;
  v_attempt int := 0;
begin
  -- NULL-safe (current_user_role() rend NULL sans ligne users_profile, et
  -- `null not in (...)` saute silencieusement le raise) : is_admin() est le
  -- pattern du repo, coalesce(false) des deux sources d'admin.
  if not public.is_admin() then
    raise exception 'admin_create_partner_code: caller is not admin'
      using errcode = '42501';
  end if;

  select company_name, contact_email, nullif(siret, ''), status
    into v_company_name, v_contact_email, v_siret, v_status
  from public.partner_applications
  where id = p_application_id;
  if v_company_name is null then
    raise exception 'admin_create_partner_code: unknown application %', p_application_id;
  end if;
  -- Barrière serveur alignée sur l'UI : pas de code pour une candidature
  -- non approuvée (l'appel RPC direct ne doit pas contourner le workflow).
  if v_status is distinct from 'approved' then
    raise exception 'admin_create_partner_code: application % is not approved (status %)',
      p_application_id, v_status;
  end if;

  -- 1) Compte partenaire (si déjà inscrit avec le même email) + sa société.
  select id, company_id into v_user_id, v_company_id
  from public.users_profile
  where lower(email) = lower(v_contact_email)
  order by created_at asc
  limit 1;

  -- 2) Résoudre la société : celle du compte, sinon par SIRET (index unique
  --    partiel idx_companies_siret_unique — un client déjà onboardé avec le
  --    même SIRET mais un libellé différent doit être retrouvé, pas recréé),
  --    sinon par nom, sinon on la crée (idempotence anti double-clic).
  if v_company_id is null and v_siret is not null then
    select id into v_company_id
    from public.companies
    where siret = v_siret
    order by created_at asc nulls last
    limit 1;
  end if;

  if v_company_id is null then
    select id into v_company_id
    from public.companies
    where legal_name = v_company_name
      and coalesce(siret, '') = coalesce(v_siret, '')
    order by created_at asc nulls last
    limit 1;
  end if;

  if v_company_id is null then
    begin
      insert into public.companies (legal_name, siret)
      values (v_company_name, v_siret)
      returning id into v_company_id;
    exception when unique_violation then
      -- Course avec un autre insert portant le même SIRET : on récupère la
      -- société gagnante au lieu de faire échouer la génération du code.
      select id into v_company_id
      from public.companies
      where siret = v_siret
      order by created_at asc nulls last
      limit 1;
      if v_company_id is null then
        raise;
      end if;
    end;
  end if;

  -- Sérialise les appels concurrents sur la même société : sans ce verrou,
  -- deux admins simultanés passeraient tous les deux le check « code actif
  -- existant » et créeraient deux codes actifs (l'idempotence serait rompue).
  perform pg_advisory_xact_lock(hashtext(v_company_id::text));

  -- Mémorise la société sur la candidature : claim_partner_access s'en sert
  -- pour rattacher le compte du partenaire quand il s'inscrit plus tard.
  update public.partner_applications
  set company_id = v_company_id, updated_at = now()
  where id = p_application_id and company_id is distinct from v_company_id;

  -- 3) Relier le compte du partenaire à la société (rend current_company_id()
  --    opérant pour lui → il voit son code + ses commissions).
  if v_user_id is not null then
    update public.users_profile
    set company_id = v_company_id, updated_at = now()
    where id = v_user_id and company_id is distinct from v_company_id;
  end if;

  -- Idempotent : un code actif existe déjà pour cette société → on le renvoie.
  if p_code is null then
    select code into v_existing_code
    from public.partner_codes
    where company_id = v_company_id and active
    order by created_at asc
    limit 1;
    if v_existing_code is not null then
      return jsonb_build_object(
        'id', (select id from public.partner_codes where code = v_existing_code),
        'code', v_existing_code,
        'company_id', v_company_id,
        'linked_user', v_user_id is not null,
        'created', false
      );
    end if;
  end if;

  -- 4) Générer un code unique (préfixe AP- + 6 hex) avec retry sur collision.
  loop
    v_attempt := v_attempt + 1;
    v_code := coalesce(
      nullif(upper(regexp_replace(p_code, '[^A-Za-z0-9-]', '', 'g')), ''),
      'AP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
    );
    begin
      insert into public.partner_codes (code, company_id)
      values (v_code, v_company_id);
      exit;
    exception when unique_violation then
      if p_code is not null or v_attempt >= 8 then
        raise exception 'admin_create_partner_code: could not allocate a unique code';
      end if;
      -- boucle : nouveau code aléatoire.
    end;
  end loop;

  -- (re)lire l'id/company réels de la ligne insérée
  return (
    select jsonb_build_object(
      'id', pc.id,
      'code', pc.code,
      'company_id', pc.company_id,
      'linked_user', v_user_id is not null,
      'created', true
    )
    from public.partner_codes pc
    where pc.code = v_code
  );
end;
$$;

revoke execute on function public.admin_create_partner_code(uuid, text)
  from public, anon;
grant execute on function public.admin_create_partner_code(uuid, text)
  to authenticated;

comment on function public.admin_create_partner_code(uuid, text) is
  'M13: génère (ou renvoie) le code apporteur d''une candidature approuvée — provisionne/relie la société du partenaire et insère partner_codes. Admin only.';

-- ---------------------------------------------------------------------------
-- claim_partner_access v2 : ferme la boucle « code généré AVANT le compte ».
-- v1 (20260607160000) ne faisait que lier partner_users par email. Désormais :
--   1. lie aussi par société (candidature approuvée de MA société — couvre un
--      email de connexion différent du contact_email de la candidature),
--   2. pose users_profile.company_id depuis la candidature email-matchée si le
--      compte n'a pas encore de société → current_company_id() devient opérant
--      et l'apporteur voit son code + ses commissions au premier login.
-- ---------------------------------------------------------------------------
create or replace function public.claim_partner_access()
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null or v_email is null then
    return;
  end if;

  -- 1) Lien par email (comportement v1 inchangé).
  insert into public.partner_users (user_id, partner_application_id, role)
  select v_uid, a.id, 'owner'
  from public.partner_applications a
  where lower(a.contact_email) = v_email
    and a.status in (
      'qualified'::public.partner_application_status,
      'approved'::public.partner_application_status
    )
  on conflict (user_id, partner_application_id) do nothing;

  -- 2) Rattache la société de la candidature au compte (une seule, la plus
  --    ancienne approuvée) si le compte n'en a pas encore.
  update public.users_profile up
  set company_id = matched.company_id, updated_at = now()
  from (
    select a.company_id
    from public.partner_applications a
    where lower(a.contact_email) = v_email
      and a.company_id is not null
      and a.status = 'approved'::public.partner_application_status
    order by a.created_at asc
    limit 1
  ) matched
  where up.id = v_uid and up.company_id is null;

  -- 3) Lien par société : candidatures de MA société (posées par l'admin via
  --    admin_create_partner_code) même si le contact_email diffère.
  insert into public.partner_users (user_id, partner_application_id, role)
  select v_uid, a.id, 'member'
  from public.partner_applications a
  join public.users_profile up on up.id = v_uid
  where a.company_id is not null
    and a.company_id = up.company_id
    and a.status in (
      'qualified'::public.partner_application_status,
      'approved'::public.partner_application_status
    )
  on conflict (user_id, partner_application_id) do nothing;

  return query
    select partner_application_id
    from public.partner_users
    where user_id = v_uid;
end;
$$;
