-- ============================================================
-- Container Club — revoke EXECUTE from PUBLIC on SECURITY DEFINER
-- helpers exposed via PostgREST.
-- ============================================================
--
-- Recovered from remote schema_migrations on 2026-06-03 during the
-- connectors audit. The next migration in the timeline
-- (20260525090000_restore_rls_helper_execute.sql) grants EXECUTE
-- back to anon + authenticated so RLS policies that call these
-- helpers keep working — the revoke from PUBLIC must stay so the
-- functions aren't reachable via /rest/v1/rpc/<fn> by guests.

revoke execute on function public.current_company_id() from public;
revoke execute on function public.current_user_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_professional() from public;
