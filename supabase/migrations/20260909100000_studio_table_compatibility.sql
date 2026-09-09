-- 42. Studio Projet Lot 4 — NON APPLIQUÉE EN PRODUCTION.
-- Additive; no product, price, auth policy or existing catalogue change.
-- No seed: only explicit human reviews can publish compatibility.
begin;
create table public.studio_table_base_types (
 id uuid primary key default extensions.gen_random_uuid(),
 label text not null check(length(trim(label)) between 2 and 120),
 created_at timestamptz not null default now()
);
create table public.studio_table_base_profiles (
 base_id text primary key references public.products(id) on delete cascade,
 base_type_id uuid not null references public.studio_table_base_types(id) on delete restrict,
 status text not null default 'draft' check(status in ('draft','verified','archived')),
 provenance text not null default '' check(length(provenance)<=1000),
 verified_by uuid references auth.users(id) on delete restrict,
 verified_at timestamptz,
 constraint studio_base_profile_review check ((status='verified' and verified_by is not null and verified_at is not null and length(trim(provenance))>=3) or (status<>'verified' and verified_by is null and verified_at is null))
);
create table public.studio_tabletop_base_rules (
 id uuid primary key default extensions.gen_random_uuid(),
 base_id text references public.products(id) on delete cascade,
 tabletop_id text references public.products(id) on delete cascade,
 base_type_id uuid references public.studio_table_base_types(id) on delete restrict,
 shape text check(shape in ('rectangular','round')),
 max_length_cm numeric check(max_length_cm>0 and max_length_cm<10000),
 max_width_cm numeric check(max_width_cm>0 and max_width_cm<10000),
 verdict text not null check(verdict in ('allowed','denied','requires_confirmation')),
 status text not null default 'draft' check(status in ('draft','verified','archived')),
 provenance text not null default '' check(length(provenance)<=1000),
 verified_by uuid references auth.users(id) on delete restrict,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 constraint studio_table_rule_scope check (
  (base_id is not null and tabletop_id is not null and base_id<>tabletop_id and base_type_id is null and shape is null and max_length_cm is null and max_width_cm is null)
  or (base_id is null and tabletop_id is null and base_type_id is not null and shape is not null and max_length_cm is not null and max_width_cm is not null and (shape<>'round' or max_length_cm=max_width_cm))
 ),
 constraint studio_table_rule_review check ((status='verified' and verified_by is not null and verified_at is not null and length(trim(provenance))>=3) or (status<>'verified' and verified_by is null and verified_at is null))
);
create unique index studio_table_pair_unique on public.studio_tabletop_base_rules(base_id,tabletop_id) where base_id is not null;
create unique index studio_table_type_shape_unique on public.studio_tabletop_base_rules(base_type_id,shape) where base_type_id is not null;

-- Shared trigger: real product roles; audit identity comes from auth.uid(),
-- never from an arbitrary user ID supplied by the browser.
create function public.studio_check_table_review() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not public.is_admin() then raise exception 'Admin review required' using errcode='42501'; end if;
 if new.base_id is not null and not exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=new.base_id and p.category='table_base' and sp.studio_role='base') then
  raise exception 'Studio base role required' using errcode='23514';
 end if;
 if tg_table_name='studio_tabletop_base_rules' then
  if new.tabletop_id is not null and not exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=new.tabletop_id and p.category='table_top' and sp.studio_role='tabletop') then
   raise exception 'Studio tabletop role required' using errcode='23514';
  end if;
 end if;
 if new.status='verified' then
  if not public.is_admin() or auth.uid() is null then raise exception 'Admin review required' using errcode='42501'; end if;
  new.verified_by=auth.uid(); new.verified_at=now();
 else new.verified_by=null; new.verified_at=null;
 end if;
 return new;
end $$;
create trigger studio_table_profile_review before insert or update on public.studio_table_base_profiles for each row execute function public.studio_check_table_review();
create trigger studio_table_rule_review before insert or update on public.studio_tabletop_base_rules for each row execute function public.studio_check_table_review();

alter table public.studio_table_base_types enable row level security;
alter table public.studio_table_base_profiles enable row level security;
alter table public.studio_tabletop_base_rules enable row level security;
revoke all on public.studio_table_base_types,public.studio_table_base_profiles,public.studio_tabletop_base_rules from public,anon,authenticated;
grant select,insert,update,delete on public.studio_table_base_types,public.studio_table_base_profiles,public.studio_tabletop_base_rules to authenticated;
create policy "Admins manage table types" on public.studio_table_base_types for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage base types" on public.studio_table_base_profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage table rules" on public.studio_tabletop_base_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());

create view public.studio_table_base_profiles_public with(security_barrier=true) as
 select b.base_id,b.base_type_id from public.studio_table_base_profiles b
 join public.products p on p.id=b.base_id join public.studio_product_profiles sp on sp.product_id=p.id
 where b.status='verified' and p.is_active and p.category='table_base' and sp.studio_role='base';
create view public.studio_tabletop_base_rules_public with(security_barrier=true) as
 select r.id,r.base_id,r.tabletop_id,r.base_type_id,r.shape,r.max_length_cm,r.max_width_cm,r.verdict
 from public.studio_tabletop_base_rules r where r.status='verified' and
 (r.base_type_id is not null or (
 exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=r.base_id and p.is_active and p.category='table_base' and sp.studio_role='base') and
 exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=r.tabletop_id and p.is_active and p.category='table_top' and sp.studio_role='tabletop')));
revoke all on public.studio_table_base_profiles_public,public.studio_tabletop_base_rules_public from public,anon,authenticated;
grant select on public.studio_table_base_profiles_public,public.studio_tabletop_base_rules_public to anon,authenticated;
revoke all on function public.studio_check_table_review() from public;

-- Event contract is extended without deleting historical values or sessions.
alter table public.studio_events drop constraint studio_events_event_type_check;
alter table public.studio_events add constraint studio_events_event_type_check check(event_type in (
 'studio_started','card_liked','card_disliked','card_passed','undo','favorite_added','favorite_removed','finalists_viewed','seat_selected','quantity_changed','project_completed',
 'convergence_ready','convergence_stalled','convergence_prompt_viewed','convergence_accepted','exploration_continued',
 'studio_tables_started','tabletop_selected','table_quantity_changed','base_selected','compatibility_verification_requested','custom_tabletop_requested'
));
commit;
