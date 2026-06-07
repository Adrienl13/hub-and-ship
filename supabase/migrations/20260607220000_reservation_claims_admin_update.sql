-- Allow admins to update claims (status + response) from the admin SAV tab.
-- Only the "Admins full access claims" policy permits UPDATE, so granting the
-- table privilege to `authenticated` is safe: non-admins have no UPDATE policy
-- and RLS denies their updates.

grant update on public.reservation_claims to authenticated;
