import { useCallback, useMemo } from 'react'

import {
  logSecurityEvent,
  type SecurityEventInput,
  type SecurityEventLogResult,
} from '@/lib/security/events'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export function useSecurityEvents() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const client = useMemo(() => {
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [config])

  const logEvent = useCallback(
    (input: SecurityEventInput): Promise<SecurityEventLogResult> =>
      logSecurityEvent(client, input),
    [client],
  )

  return {
    isConfigured: config.isConfigured,
    logEvent,
  }
}
