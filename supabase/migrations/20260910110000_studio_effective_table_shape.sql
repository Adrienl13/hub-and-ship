-- 44. Studio effective shapes — NON APPLIQUÉE EN PRODUCTION.
-- Catalogue values remain unchanged. No rules or memberships are seeded.
begin;
alter table public.studio_tabletop_base_rules
 drop constraint studio_tabletop_base_rules_shape_check;
alter table public.studio_tabletop_base_rules
 add constraint studio_tabletop_base_rules_shape_check
 check (shape in ('round','square','rectangular'));
-- A square has equal sides: even independently nullable bounds must admit a solution.
alter table public.studio_tabletop_base_rules
 add constraint studio_table_rule_square_dimensions check (
 shape <> 'square' or
 greatest(coalesce(min_length_cm,0),coalesce(min_width_cm,0)) <=
 least(coalesce(max_length_cm,10000),coalesce(max_width_cm,10000))
 );
commit;
