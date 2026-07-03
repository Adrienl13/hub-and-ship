import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { useChannel } from '@/hooks/useChannel'
import {
  loadPartnerSpace,
  type PartnerSpaceClient,
  type PartnerSpaceData,
} from '@/lib/partner-space/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { SalesChannel } from '@/lib/supabase/types'

export type PartnerSpaceStatus =
  | 'loading'
  | 'unconfigured'
  | 'anonymous'
  | 'not_partner'
  | 'ready'

export interface UsePartnerSpaceResult {
  readonly status: PartnerSpaceStatus
  readonly channel: SalesChannel
  readonly data: PartnerSpaceData
  readonly error: string | null
  readonly reload: () => void
}

const EMPTY: PartnerSpaceData = { codes: [], commissions: [] }

/**
 * Drives the connected /partenaire space. A visitor is a partner when they are
 * authenticated AND (their channel ≠ direct OR they hold at least one partner
 * code). Data is RLS-scoped server-side — the client only ever loads its own.
 */
export function usePartnerSpace(): UsePartnerSpaceResult {
  const auth = useAuth()
  const { channel, isLoading: channelLoading } = useChannel()
  const [data, setData] = useState<PartnerSpaceData>(EMPTY)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const config = useMemo(() => getSupabasePublicConfig(), [])

  useEffect(() => {
    if (auth.status !== 'authenticated' || !config.isConfigured) {
      setData(EMPTY)
      setDataLoading(false)
      return
    }
    let cancelled = false
    setDataLoading(true)
    const client = createSupabaseBrowserClient(config) as PartnerSpaceClient
    void loadPartnerSpace(client)
      .then((loaded) => {
        if (cancelled) return
        setData(loaded)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth.status, config, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const status: PartnerSpaceStatus = (() => {
    if (auth.status === 'unconfigured') return 'unconfigured'
    if (auth.status === 'loading' || channelLoading || dataLoading)
      return 'loading'
    if (auth.status !== 'authenticated') return 'anonymous'
    const isPartner = channel !== 'direct' || data.codes.length > 0
    return isPartner ? 'ready' : 'not_partner'
  })()

  return { status, channel, data, error, reload }
}
