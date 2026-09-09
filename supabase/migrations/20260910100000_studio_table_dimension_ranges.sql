-- 43. Studio dimensional ranges — NON APPLIQUÉE EN PRODUCTION.
-- Additive only: no catalogue data or commercial compatibility is inferred.
begin;
alter table public.studio_tabletop_base_rules
 add column min_length_cm numeric check(min_length_cm > 0 and min_length_cm < 10000),
 add column min_width_cm numeric check(min_width_cm > 0 and min_width_cm < 10000),
 drop constraint studio_table_rule_scope;
alter table public.studio_tabletop_base_rules add constraint studio_table_rule_scope check (
 (base_id is not null and tabletop_id is not null and base_id <> tabletop_id
  and base_type_id is null and shape is null
  and min_length_cm is null and min_width_cm is null
  and max_length_cm is null and max_width_cm is null)
 or (base_id is null and tabletop_id is null and base_type_id is not null and shape is not null)
);
-- Both known sides normalize with rotation. A lone length is the long side;
-- a lone width is the short side. NULL supplies no bound.
alter table public.studio_tabletop_base_rules add constraint studio_table_rule_dimensions check (
 (shape <> 'round' or (
   (min_length_cm is null or min_width_cm is null or min_length_cm = min_width_cm)
   and (max_length_cm is null or max_width_cm is null or max_length_cm = max_width_cm)
   and greatest(coalesce(min_length_cm,0),coalesce(min_width_cm,0)) <= least(coalesce(max_length_cm,10000),coalesce(max_width_cm,10000))
 ))
 and (case when min_length_cm is not null and min_width_cm is not null then greatest(min_length_cm,min_width_cm) else coalesce(min_length_cm,0) end)
  <= (case when max_length_cm is not null and max_width_cm is not null then greatest(max_length_cm,max_width_cm) else coalesce(max_length_cm,10000) end)
 and (case when min_length_cm is not null and min_width_cm is not null then least(min_length_cm,min_width_cm) else coalesce(min_width_cm,0) end)
  <= (case when max_length_cm is not null and max_width_cm is not null then least(max_length_cm,max_width_cm) else coalesce(max_width_cm,10000) end)
 and (case when min_length_cm is not null and min_width_cm is not null then least(min_length_cm,min_width_cm) else coalesce(min_width_cm,0) end)
  <= (case when max_length_cm is not null and max_width_cm is not null then greatest(max_length_cm,max_width_cm) else coalesce(max_length_cm,10000) end)
);
-- Append columns to retain the existing view identity, privileges and dependencies.
create or replace view public.studio_tabletop_base_rules_public with(security_barrier=true) as
 select r.id,r.base_id,r.tabletop_id,r.base_type_id,r.shape,r.max_length_cm,r.max_width_cm,r.verdict,r.min_length_cm,r.min_width_cm
 from public.studio_tabletop_base_rules r where r.status='verified' and
 (r.base_type_id is not null or (
 exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=r.base_id and p.is_active and p.category='table_base' and sp.studio_role='base') and
 exists(select 1 from public.products p join public.studio_product_profiles sp on sp.product_id=p.id where p.id=r.tabletop_id and p.is_active and p.category='table_top' and sp.studio_role='tabletop')));
revoke all on public.studio_tabletop_base_rules_public from public,anon,authenticated;
grant select on public.studio_tabletop_base_rules_public to anon,authenticated;
commit;
