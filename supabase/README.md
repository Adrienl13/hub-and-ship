# Supabase setup — hub-and-ship

This folder contains SQL migrations that build the database expected by
the front-end Supabase client (`src/lib/supabase.ts`, `src/lib/reservations.ts`).

## Project lock

The only Supabase project authorized for this codebase is
**`mkfztwibolswqcggukeq`**. Any agent must refuse to operate on any other
project, in particular `TerrasseaHUB`. See `CLAUDE.md` § Supabase.

## Before applying

1. Confirm the project-scoped MCP server is registered:

   ```bash
   cat .mcp.json
   # Expected: an "supabase" entry pointing to
   # https://mcp.supabase.com/mcp?project_ref=mkfztwibolswqcggukeq
   ```

2. Authenticate it (one time):

   ```bash
   claude /mcp
   # Pick "supabase" → Authenticate (OAuth in browser).
   ```

3. Optionally restart your Claude Code session so the new MCP tools are
   loaded.

## Applying the migrations

### Option A — Supabase MCP (preferred, no CLI install)

Once the project-scoped MCP is authenticated, ask Claude to apply each
migration in order:

```text
Apply supabase/migrations/20260519190000_initial_schema.sql to project mkfztwibolswqcggukeq
Apply supabase/migrations/20260519190001_rls_policies.sql to project mkfztwibolswqcggukeq
```

Claude must call `mcp__supabase__apply_migration` with the exact
`project_id`. Any call targeting another project must be refused.

### Option B — Supabase CLI

```bash
npx supabase link --project-ref mkfztwibolswqcggukeq
npx supabase db push
```

## After applying

1. Regenerate the TypeScript types (replaces `src/lib/db-types.ts`):

   ```bash
   npx supabase gen types typescript \
     --project-id mkfztwibolswqcggukeq \
     --schema public > src/lib/db-types.ts
   ```

   Or via MCP: call `mcp__supabase__generate_typescript_types` with
   `project_id: "mkfztwibolswqcggukeq"`.

2. Wire `createReservation()` (from `src/lib/reservations.ts`) into
   `ReservationDialog.tsx` step 2 in place of the `setTimeout` mock.

3. Verify in the Supabase dashboard that:
   - Both tables exist with the expected columns.
   - RLS is **enabled** on both tables.
   - The anon role has INSERT only (no SELECT/UPDATE/DELETE).

## Hardening checklist (post-MVP)

- [ ] Add a `professionals` table linked to `auth.users`.
- [ ] Switch reservations from anon-INSERT to authenticated INSERT scoped to `professional_id = auth.uid()`.
- [ ] Add SELECT/UPDATE policies so each professional sees only their own reservations (client dashboard).
- [ ] Define an `admin` role for the back-office dashboard, with full read access.
- [ ] Add rate-limiting at the edge (Cloudflare WAF or a Supabase Edge Function with a sliding window).
- [ ] Move money totals through a server-side recompute (Edge Function) before status flips to `paid` — never trust the client.
- [ ] Wire Stripe webhook → Edge Function that updates `status` and `stripe_payment_intent_id`.
