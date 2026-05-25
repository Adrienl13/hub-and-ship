-- Unify the two admin notions.
--
-- The app's AdminGuard (useIsAdmin) treats a user as admin when
-- users_profile.role in ('admin','super_admin'). But is_admin() — used by the
-- RLS write policies on products, product_variants, containers,
-- container_seed_commitments and the "admins select all professionals" read
-- policy — only looked at professionals.is_admin. A user who is admin via
-- users_profile.role but has no professionals row could open the admin UI yet
-- silently fail every catalogue write.
--
-- Make is_admin() true when the caller is admin by EITHER source so there is a
-- single, consistent admin model across the app.
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select coalesce(
           (select is_admin from public.professionals where id = auth.uid()),
           false
         )
      or coalesce(
           (select role in ('admin', 'super_admin')
              from public.users_profile where id = auth.uid()),
           false
         );
$function$;
