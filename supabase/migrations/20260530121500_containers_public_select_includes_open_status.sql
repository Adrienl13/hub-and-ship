-- Refine the public SELECT on `containers`.
--
-- The previous migration in this audit pass
-- (20260530120000_versioned_admin_policies_and_container_publication_gate)
-- restricted anon SELECT to `published_at IS NOT NULL`, which is the right
-- gate for the editorial "/livres" feed (delivered containers presented as
-- stories) but accidentally hid the currently OPEN container (CC-2026-001),
-- which the public catalogue (`/catalogue`) needs to read by `status='open'`
-- to surface the live pre-order.
--
-- The two visibility rules are independent:
--   - `status = 'open'`  → commercial: the public catalogue needs it.
--   - `published_at`     → editorial: the /livres gallery needs it.
-- Anything that is neither open nor published is a draft (e.g. a future
-- container still being prepared) and stays hidden.

drop policy if exists "containers are public" on public.containers;
create policy "containers are public"
  on public.containers for select
  using (
    published_at is not null
    or status = 'open'
  );
