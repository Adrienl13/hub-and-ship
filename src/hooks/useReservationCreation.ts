import { useCallback, useMemo } from 'react'

import type { ReservationDraft } from '@/lib/reservations/draft'
import {
  createReservationInSupabase,
  type CreateReservationResult,
} from '@/lib/reservations/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type ReservationCreationResult =
  | {
      readonly ok: true
      readonly persisted: true
      readonly reservation: CreateReservationResult
    }
  | {
      readonly ok: true
      readonly persisted: false
      readonly reservation: Pick<ReservationDraft, 'reference'>
    }
  | { readonly ok: false; readonly error: string }

export function useReservationCreation() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const client = useMemo(() => {
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [config])

  const createReservation = useCallback(
    async (draft: ReservationDraft): Promise<ReservationCreationResult> => {
      if (!client) {
        return {
          ok: true,
          persisted: false,
          reservation: { reference: draft.reference },
        }
      }

      try {
        const reservation = await createReservationInSupabase({
          client,
          draft,
        })

        return { ok: true, persisted: true, reservation }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Création réservation impossible',
        }
      }
    },
    [client],
  )

  return {
    isConfigured: config.isConfigured,
    createReservation,
  }
}
