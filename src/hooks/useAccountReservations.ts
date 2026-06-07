import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import {
  accountReservationFromMyReservation,
  mergeAccountReservations,
  type AccountReservation,
} from '@/lib/account/reservations'
import {
  readLocalReservationHistory,
  type LocalReservationRecord,
} from '@/lib/reservations/local-history'
import { listMyReservationsFromSupabase } from '@/lib/reservations/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export interface UseAccountReservationsResult {
  readonly reservations: ReadonlyArray<AccountReservation>
  readonly loading: boolean
  readonly error: string | null
  readonly authStatus: ReturnType<typeof useAuth>['status']
  readonly isConfigured: boolean
}

/**
 * Loads the signed-in user's reservations from Supabase (RLS-scoped) merged
 * with the local checkout history (so anonymous-then-signed-in users keep
 * seeing their device reservations). Shared by /account and
 * /account/reservations so both surfaces stay consistent.
 */
export function useAccountReservations(): UseAccountReservationsResult {
  const auth = useAuth()
  const [localRecords, setLocalRecords] = useState<
    ReadonlyArray<LocalReservationRecord>
  >([])
  const [remoteReservations, setRemoteReservations] = useState<
    ReadonlyArray<AccountReservation>
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocalRecords(readLocalReservationHistory(window.localStorage))
  }, [])

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setRemoteReservations([])
      setError(null)
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return

    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(config)
        const list = await listMyReservationsFromSupabase(
          client as unknown as Parameters<
            typeof listMyReservationsFromSupabase
          >[0],
        )
        if (cancelled) return
        setRemoteReservations(list.map(accountReservationFromMyReservation))
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [auth.status])

  const reservations = useMemo(
    () => mergeAccountReservations({ remoteReservations, localRecords }),
    [remoteReservations, localRecords],
  )

  return {
    reservations,
    loading,
    error,
    authStatus: auth.status,
    isConfigured: getSupabasePublicConfig().isConfigured,
  }
}
