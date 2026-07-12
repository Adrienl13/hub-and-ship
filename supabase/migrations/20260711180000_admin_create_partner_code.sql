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
create unique index if not exists partner_codes_code_lower_uidx
  on public.partner_codes (lower(code));

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
  v_user_id uuid;
  v_company_id uuid;
  v_code text;
  v_existing_code text;
  v_attempt int := 0;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception 'admin_create_partner_code: caller is not admin'
      using errcode = '42501';
  end if;

  select company_name, contact_email, nullif(siret, '')
    into v_company_name, v_contact_email, v_siret
  from public.partner_applications
  where id = p_application_id;
  if v_company_name is null then
    raise exception 'admin_create_partner_code: unknown application %', p_application_id;
  end if;

  -- 1) Compte partenaire (si déjà inscrit avec le même email) + sa société.
  select id, company_id into v_user_id, v_company_id
  from public.users_profile
  where lower(email) = lower(v_contact_email)
  order by created_at asc
  limit 1;

  -- 2) Résoudre la société : celle du compte, sinon une société existante au
  --    même nom+SIRET, sinon on la crée (idempotence anti double-clic).
  if v_company_id is null then
    select id into v_company_id
    from public.companies
    where legal_name = v_company_name
      and coalesce(siret, '') = coalesce(v_siret, '')
    order by created_at asc nulls last
    limit 1;
  end if;

  if v_company_id is null then
    insert into public.companies (legal_name, siret)
    values (v_company_name, v_siret)
    returning id into v_company_id;
  end if;

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
