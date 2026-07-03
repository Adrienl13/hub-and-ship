import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { SalesChannel } from '@/lib/supabase/types'

export interface UseChannelResult {
  readonly channel: SalesChannel
  readonly isLoading: boolean
}

/**
 * Resolves the current account's sales channel via the `current_channel()`
 * Postgres helper (anon / unconfigured / error → 'direct'). A caller can only
 * ever learn their OWN channel. Drives the "Tarif <canal> actif" badge and the
 * gating of volume discounts / loss leaders (direct only).
 */
export function useChannel(): UseChannelResult {
  const auth = useAuth()
  const [channel, setChannel] = useState<SalesChannel>('direct')
  const [isLoading, setIsLoading] = useState(auth.status === 'loading')

  const client = useMemo(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [])

  useEffect(() => {
    if (!client || auth.status !== 'authenticated' || !auth.user) {
      setChannel('direct')
      setIsLoading(auth.status === 'loading')
      return
    }

    let cancelled = false
    setIsLoading(true)
    void client.rpc('current_channel').then(({ data, error }) => {
      if (cancelled) return
      setChannel(error || !data ? 'direct' : (data as SalesChannel))
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [client, auth.status, auth.user])

  return { channel, isLoading }
}
