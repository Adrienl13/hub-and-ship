import { useCallback, useMemo } from 'react'

import { getAttributionFields } from '@/lib/analytics/attribution'
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
      readonly fallbackReason: string
    }
  | { readonly ok: false; readonly error: string }

interface StockRequestApiResponse {
  readonly ok: boolean
  readonly persisted?: boolean
  readonly request?: CreateStockRequestResult
  readonly error?: string
}

function toApiPayload(draft: StockRequestDraft) {
  return {
    stockLineId: draft.stockLineId,
    companyName: draft.companyName,
    contactEmail: draft.contactEmail,
    contactPhone: draft.contactPhone,
    requestedQuantity: draft.requestedQuantity,
    customerNote: draft.customerNote,
  }
}

function getApiOrigin(): string | null {
  if (typeof window === 'undefined') return null
  return window.location.origin
}

async function createStockRequestViaServer(
  draft: StockRequestDraft,
): Promise<CreateStockRequestResult | null> {
  const origin = getApiOrigin()
  if (!origin || typeof fetch !== 'function') return null

  try {
    const response = await fetch(new URL('/api/stock-requests', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toApiPayload(draft)),
    })
    const payload = (await response.json()) as StockRequestApiResponse

    if (
      response.ok &&
      payload.ok &&
      payload.persisted === true &&
      payload.request
    ) {
      return payload.request
    }
  } catch {
    return null
  }

  return null
}

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
        const serverRequest = await createStockRequestViaServer(draft)
        if (serverRequest) {
          saveLocal()
          return { ok: true, persisted: true, request: serverRequest }
        }

        saveLocal()
        return {
          ok: true,
          persisted: false,
          request: { localId: draft.localId, status: draft.status },
          fallbackReason:
            'Supabase public non configuré et route serveur indisponible.',
        }
      }

      try {
        const request = await createStockRequestInSupabase({
          client,
          draft,
          attribution: getAttributionFields(Date.now()),
        })
        saveLocal()
        // Emails (admin + accusé) are sent by the /api/stock-requests server
        // route (Brevo). The direct browser-insert path skips them; P3 will
        // flip the order to server-first so every lead gets notified.
        return { ok: true, persisted: true, request }
      } catch (error) {
        const serverRequest = await createStockRequestViaServer(draft)
        if (serverRequest) {
          saveLocal()
          return { ok: true, persisted: true, request: serverRequest }
        }

        saveLocal()
        return {
          ok: true,
          persisted: false,
          request: { localId: draft.localId, status: draft.status },
          fallbackReason:
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
