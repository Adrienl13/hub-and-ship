import type {
  Database,
  Json,
  SecurityEventSeverity,
  SecurityEventType,
} from '@/lib/supabase/types'

type SecurityEventInsert =
  Database['public']['Tables']['security_events']['Insert']

interface SecurityEventInsertResult {
  readonly error: { readonly message: string } | null
}

export interface SecurityEventInput {
  readonly eventType: SecurityEventType
  readonly severity?: SecurityEventSeverity
  readonly userId?: string | null
  readonly companyId?: string | null
  readonly ipAddress?: string | null
  readonly userAgent?: string | null
  readonly requestId?: string | null
  readonly metadata?: Json
}

export interface SecurityEventLogResult {
  readonly ok: boolean
  readonly skipped: boolean
  readonly error?: string
}

export interface SecurityEventClient {
  from: (table: 'security_events') => {
    insert: (
      payload: SecurityEventInsert,
    ) => PromiseLike<SecurityEventInsertResult>
  }
}

export function buildSecurityEventPayload(input: SecurityEventInput) {
  return {
    event_type: input.eventType,
    severity: input.severity ?? 'info',
    user_id: input.userId ?? null,
    company_id: input.companyId ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? getBrowserUserAgent(),
    request_id: input.requestId ?? null,
    metadata: input.metadata ?? null,
  } satisfies SecurityEventInsert
}

export async function logSecurityEvent(
  client: SecurityEventClient | null,
  input: SecurityEventInput,
): Promise<SecurityEventLogResult> {
  if (!client) {
    return { ok: false, skipped: true, error: 'Supabase non configuré' }
  }

  try {
    const { error } = await client
      .from('security_events')
      .insert(buildSecurityEventPayload(input))

    if (error) {
      return { ok: false, skipped: false, error: error.message }
    }

    return { ok: true, skipped: false }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

function getBrowserUserAgent(): string | null {
  if (typeof navigator === 'undefined') return null

  return navigator.userAgent
}
