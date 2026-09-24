-- 58. Durcissement après revue (24/09/2026) des migrations 56 et 57.
--
-- 1. contact_requests : la clé anon est publique (bundle du site). Sans borne
--    de taille en base, un script peut contourner /api/contact (zod, limite de
--    débit, origine) et insérer des lignes de plusieurs Mo qui rendent
--    l'onglet Demandes et les indicateurs inutilisables. Les bornes reprennent
--    celles du formulaire (src/lib/contact.ts) avec une marge ; la policy
--    d'insertion est restreinte aux rôles anon et authenticated.
-- 2. set_my_company : quand un admin rattache plusieurs acheteurs au même
--    établissement, un seul d'entre eux ne doit pas pouvoir le renommer pour
--    tous. Le renommage n'est possible que si l'établissement n'a qu'un
--    membre ; sinon la fonction laisse la fiche intacte et rend son id.

-- 1. Bornes et rôles ----------------------------------------------------------

alter table public.contact_requests
  drop constraint if exists contact_requests_lengths;
alter table public.contact_requests
  add constraint contact_requests_lengths check (
    length(topic) <= 40
    and length(source) <= 40
    and length(name) <= 140
    and length(email) <= 254
    and (company is null or length(company) <= 140)
    and (phone is null or length(phone) <= 40)
    and length(message) <= 6000
    and (product_sku is null or length(product_sku) <= 80)
    and (product_name is null or length(product_name) <= 200)
    and (product_design is null or length(product_design) <= 200)
    and (price_label is null or length(price_label) <= 80)
    and (studio_brief is null or length(studio_brief) <= 6000)
    and (utm_source is null or length(utm_source) <= 120)
    and (utm_medium is null or length(utm_medium) <= 120)
    and (utm_campaign is null or length(utm_campaign) <= 120)
    and (partner_ref is null or length(partner_ref) <= 120)
    and (quantity is null or quantity <= 100000)
  );

drop policy if exists "Public creates contact requests" on public.contact_requests;
create policy "Public creates contact requests"
  on public.contact_requests for insert
  to anon, authenticated
  with check (status = 'new' and internal_note is null);

-- 2. Renommage réservé à un établissement à un seul membre -------------------

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
  v_members integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 140 then
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
    return v_company_id;
  end if;

  select count(*) into v_members
  from public.users_profile
  where company_id = v_company_id;

  -- Établissement partagé (rattachement fait par l'admin) : la fiche ne bouge
  -- pas depuis l'espace client.
  if v_members > 1 then
    return v_company_id;
  end if;

  update public.companies
  set trading_name = v_name,
      legal_name = case when siret_verified then legal_name else v_name end,
      updated_at = now()
  where id = v_company_id;

  return v_company_id;
end;
$$;

revoke execute on function public.set_my_company(text) from public, anon;
grant execute on function public.set_my_company(text) to authenticated;
