-- Durcissement pré-lancement terrassea.com (audit 08/2026).
--
-- 1) stock_requests : l'INSERT public ne peut plus fixer un statut avancé ni
--    écrire une note interne — ces champs appartiennent au back-office.
-- 2) subscribe_container_notification : bornes de longueur explicites
--    (anti-abus stockage ; l'index unique lower(email) reste la déduplication).
-- 3) Référence usine héritée « ZF2000C » : si un produit la porte encore en
--    SKU public, on le re-stampe en SKU maison neutre (le SKU apparaît dans
--    les URLs, le feed Merchant et le JSON-LD publics). Le SKU témoin du
--    moteur de prix est re-pointé sur l'id produit (opaque) — le contrôle de
--    dérive match déjà par id (p.sku = control_sku OR p.id = control_sku).

-- ---------------------------------------------------------------------------
-- 1. stock_requests — resserrage de la policy d'insertion publique.
-- ---------------------------------------------------------------------------
drop policy if exists "Public creates stock requests" on public.stock_requests;
create policy "Public creates stock requests"
  on public.stock_requests for insert
  with check (status = 'new' and internal_note is null);

-- ---------------------------------------------------------------------------
-- 2. subscribe_container_notification — bornes de longueur.
-- ---------------------------------------------------------------------------
create or replace function public.subscribe_container_notification(
  p_email text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
begin
  if length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'subscribe_container_notification: invalid email';
  end if;

  if v_source is not null and length(v_source) > 120 then
    v_source := left(v_source, 120);
  end if;

  insert into public.container_notify_leads (email, source)
  values (v_email, v_source)
  on conflict (lower(email)) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.subscribe_container_notification(text, text)
  from public;
grant execute on function public.subscribe_container_notification(text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. SKU maison à la place de la référence usine (conditionnel : no-op si le
--    produit n'existe pas ou si le SKU neutre est déjà pris).
-- ---------------------------------------------------------------------------
do $$
declare
  v_product_id text;
begin
  select p.id into v_product_id
  from public.products p
  where p.sku = 'ZF2000C'
  limit 1;

  if v_product_id is not null
     and not exists (select 1 from public.products where sku = 'TSA-CHR-001')
  then
    update public.products
      set sku = 'TSA-CHR-001', updated_at = now()
      where id = v_product_id;
  end if;

  -- Le témoin du moteur pointe désormais l'id produit (opaque), plus la
  -- référence usine. Fonctionne même si le produit ci-dessus n'existe plus.
  if v_product_id is not null then
    update public.pricing_parameters
      set control_sku = v_product_id, updated_at = now()
      where control_sku = 'ZF2000C';
  end if;
end $$;
