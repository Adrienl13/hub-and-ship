import { useCallback, useMemo } from 'react'

import { getAttributionFields } from '@/lib/analytics/attribution'
import { sendStockRequestNotification } from '@/lib/email/stock-request-notification'
import {
  saveStockRequestToLocalHistory,
  type StockRequestDraft,
} from '@/lib/stock-requests'
import {
  createStockRequestInSupabase,
  type CreateStockRequestResult,
} from '@/lib/stock-requests.repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type StockRequestCreationResult =
  | {
      readonly ok: true
      readonly persisted: true
      readonly request: CreateStockRequestResult
    }
  | {
      readonly ok: true
      readonly persisted: false
      readonly request: Pick<StockRequestDraft, 'localId' | 'status'>
    }
  | { readonly ok: false; readonly error: string }

export function useStockRequestCreation() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const client = useMemo(() => {
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [config])

  const createStockRequest = useCallback(
    async (draft: StockRequestDraft): Promise<StockRequestCreationResult> => {
      const saveLocal = () => {
        if (typeof window === 'undefined') return
        saveStockRequestToLocalHistory({
          storage: window.localStorage,
          draft,
        })
      }

      if (!client) {
        saveLocal()
        return {
          ok: true,
          persisted: false,
          request: { localId: draft.localId, status: draft.status },
        }
      }

      try {
        const request = await createStockRequestInSupabase({
          client,
          draft,
          attribution: getAttributionFields(Date.now()),
        })
        saveLocal()
        // Fire-and-forget admin notification. The lead is already persisted —
        // any email pipeline failure is logged server-side, not surfaced.
        void sendStockRequestNotification({
          data: { stockRequestId: request.id },
        }).catch((error) => {
          console.error('sendStockRequestNotification failed', error)
        })
        return { ok: true, persisted: true, request }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Création demande stock impossible',
        }
      }
    },
    [client],
  )

  return {
    isConfigured: config.isConfigured,
    createStockRequest,
  }
}
