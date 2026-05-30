// Thin wrapper over `logSecurityEvent` for admin back-office actions.
//
// Goal: every status flip, publish/unpublish, role change, delete and CRUD
// from the admin UI leaves a row in `public.security_events` with
// event_type='admin_action' so we can answer "who did what, and when?"
// without rebuilding state from inferred Supabase logs.
//
// We log AFTER the underlying write succeeded — never before — so a failed
// mutation does not produce a misleading audit trail. Failures of the audit
// insert itself are swallowed (returned as `{ ok: false }`) so the user
// flow is never blocked by a logging hiccup.

import { logSecurityEvent } from '@/lib/security/events'
import type { SecurityEventClient } from '@/lib/security/events'
import type { Json } from '@/lib/supabase/types'

export interface AdminActionMetadata {
  readonly action: string
  readonly target?: string
  readonly previousValue?: string | number | null
  readonly nextValue?: string | number | null
  readonly note?: string
  readonly extra?: Record<string, Json>
}

export async function logAdminAction(
  client: SecurityEventClient | null,
  userId: string | null,
  metadata: AdminActionMetadata,
): Promise<void> {
  const payload: Json = {
    action: metadata.action,
    ...(metadata.target !== undefined ? { target: metadata.target } : {}),
    ...(metadata.previousValue !== undefined
      ? { previous: metadata.previousValue }
      : {}),
    ...(metadata.nextValue !== undefined ? { next: metadata.nextValue } : {}),
    ...(metadata.note !== undefined ? { note: metadata.note } : {}),
    ...(metadata.extra ?? {}),
  }

  await logSecurityEvent(client, {
    eventType: 'admin_action',
    severity: 'info',
    userId,
    metadata: payload,
  })
}
