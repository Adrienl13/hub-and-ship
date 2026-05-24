-- Lock down SECURITY DEFINER helpers that were callable via the public
-- PostgREST RPC surface. Per Supabase advisors 0028 + 0029:
--   - current_company_id, current_user_role, is_admin
--     → used internally by RLS, never meant to be called as RPC. Revoke
--       EXECUTE from anon/authenticated so they cannot be hit via
--       /rest/v1/rpc/<fn> by a curious caller.
--   - handle_new_user, handle_new_professional
--     → trigger handlers (BEFORE/AFTER INSERT on auth.users). Should never
--       be invoked manually. Revoke EXECUTE.
--
-- Also fix the search_path of set_updated_at so it can't be hijacked by
-- shadow schemas (advisor 0011).

alter function public.set_updated_at() set search_path = pg_catalog, public;

-- The default GRANT EXECUTE ... TO PUBLIC inherited from PostgreSQL means
-- revoking from anon/authenticated alone leaves the function reachable.
-- Revoking from PUBLIC is what actually pulls the RPC surface down.
revoke execute on function public.current_company_id() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_professional() from public, anon, authenticated;
