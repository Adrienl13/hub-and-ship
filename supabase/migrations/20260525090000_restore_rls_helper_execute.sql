-- Restore EXECUTE on the RLS-helper functions.
--
-- Migration 20260523180000_harden_security_definer_functions revoked EXECUTE
-- on current_user_role(), current_company_id() and is_admin() from
-- anon/authenticated to pull them off the PostgREST RPC surface. But these
-- helpers are called *inside* RLS policies across 14 tables. A SECURITY
-- DEFINER function still requires the CALLER to hold EXECUTE, so revoking it
-- made every policy that references them fail with
--   "permission denied for function current_user_role"
-- which broke authenticated reads/writes site-wide (admin role lookup,
-- reservations, companies, products, ...).
--
-- These functions only expose the CALLER's own role/company/admin flag
-- (resolved via auth.uid()), so granting EXECUTE leaks nothing about other
-- users even if reachable via RPC.
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.current_company_id() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
