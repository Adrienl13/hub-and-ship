-- 45. Studio Lot 5 — NON APPLIQUÉE EN PRODUCTION. No commercial seeds.
begin;
create table public.studio_customization_capabilities (
 id uuid primary key default extensions.gen_random_uuid(),
 product_id text references public.products(id) on delete cascade,
 scope text not null check(scope in ('seat','tabletop','base','line_item','project')),
 kind text not null,
 status text not null default 'unknown' check(status in ('verified','on_request','unavailable','unknown')),
 values jsonb not null default '[]'::jsonb,
 allows_free_text boolean not null default false,
 requires_review boolean not null default true,
 min_quantity integer check(min_quantity>0), max_quantity integer check(max_quantity>0),
 provenance text not null default '' check(length(provenance)<=1000),
 verified_by uuid references auth.users(id) on delete restrict,
 verified_at timestamptz,
 is_active boolean not null default true,
 constraint studio_customization_scope check (
 (scope in ('seat','tabletop','base') and product_id is not null) or
 (scope in ('line_item','project') and product_id is null)),
 constraint studio_customization_kind check (
 (scope='seat' and kind in ('structure_color','weave_color','weave_pattern','textilene_color','rope_color','finish','note')) or
 (scope='tabletop' and kind in ('tabletop_finish','tabletop_color','cerclage')) or
 (scope='base' and kind in ('base_color','base_finish')) or
 (scope in ('line_item','project') and kind in ('desired_delivery_window','logo_request','ral_request','custom_dimensions_request','special_request_note'))),
 constraint studio_customization_quantity check(min_quantity is null or max_quantity is null or min_quantity<=max_quantity),
 constraint studio_customization_review check(
 (status='unknown' and verified_by is null and verified_at is null) or
 (status<>'unknown' and verified_by is not null and verified_at is not null and length(trim(provenance))>=3))
);
create unique index studio_customization_product_key on public.studio_customization_capabilities(product_id,scope,kind) where product_id is not null;
create unique index studio_customization_global_key on public.studio_customization_capabilities(scope,kind) where product_id is null;
create function public.studio_check_customization_review() returns trigger language plpgsql set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin review required' using errcode='42501'; end if;
 if jsonb_typeof(new.values)<>'array' then raise exception 'Values must be an array' using errcode='23514'; end if;
 if jsonb_array_length(new.values)>100 or exists(select 1 from jsonb_array_elements(new.values) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 120) then raise exception 'Invalid values' using errcode='23514'; end if;
 if new.product_id is not null and not exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=new.product_id and sp.studio_role=new.scope) then raise exception 'Wrong product role' using errcode='23514'; end if;
 if new.status='unknown' then new.verified_by:=null;new.verified_at:=null;
 else new.verified_by:=auth.uid();new.verified_at:=now(); end if;
 return new;
end $$;
create trigger studio_customization_review before insert or update on public.studio_customization_capabilities for each row execute function public.studio_check_customization_review();
revoke all on function public.studio_check_customization_review() from public;
alter table public.studio_customization_capabilities enable row level security;
revoke all on public.studio_customization_capabilities from public,anon,authenticated;
grant select,insert,update,delete on public.studio_customization_capabilities to authenticated;
create policy "Admins manage customization" on public.studio_customization_capabilities for all to authenticated using(public.is_admin()) with check(public.is_admin());
create view public.studio_customization_capabilities_public with(security_barrier=true) as
 select c.id,c.product_id,c.scope,c.kind,c.status,c.values,c.allows_free_text,c.requires_review,c.min_quantity,c.max_quantity
 from public.studio_customization_capabilities c where c.is_active and
 (c.product_id is null or exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=c.product_id and p.is_active and sp.studio_role=c.scope));
revoke all on public.studio_customization_capabilities_public from public,anon,authenticated;
grant select on public.studio_customization_capabilities_public to anon,authenticated;
commit;
