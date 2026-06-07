import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export interface UseIsPartnerResult {
  readonly isPartner: boolean
  readonly isLoading: boolean
}

/**
 * Calls the `public.is_partner()` Postgres helper to decide whether the current
 * user is linked to an approved partner application (table `partner_users`).
 * Mirrors {@link useIsAdmin}: read-only, no side effect, returns
 * `isPartner=false` for anonymous or unconfigured visitors so the header link
 * can short-circuit. A freshly-approved partner only becomes "partner" after
 * `claim_partner_access()` runs once (on their first /partner visit).
 */
export function useIsPartner(): UseIsPartnerResult {
  const auth = useAuth()
  const [isPartner, setIsPartner] = useState(false)
  const [isLoading, setIsLoading] = useState(auth.status === 'loading')

  const client = useMemo(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [])

  useEffect(() => {
    if (!client) {
      setIsPartner(false)
      setIsLoading(false)
      return
    }
    if (auth.status === 'loading') {
      setIsLoading(true)
      return
    }
    if (auth.status !== 'authenticated' || !auth.user) {
      setIsPartner(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    void client.rpc('is_partner').then(({ data, error }) => {
      if (cancelled) return
      setIsPartner(!error && data === true)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [client, auth.status, auth.user])

  return { isPartner, isLoading }
}
