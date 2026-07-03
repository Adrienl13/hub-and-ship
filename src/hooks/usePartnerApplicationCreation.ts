import { useCallback, useMemo } from 'react'

import { getAttributionFields } from '@/lib/analytics/attribution'
import { sendPartnerApplicationNotification } from '@/lib/email/partner-application-notification'
import type { PartnerApplicationDraft } from '@/lib/partner-applications'
import {
  createPartnerApplicationInSupabase,
  type CreatePartnerApplicationResult,
} from '@/lib/partner-applications.repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type PartnerApplicationCreationResult =
  | {
      readonly ok: true
      readonly persisted: true
      readonly application: CreatePartnerApplicationResult
    }
  | { readonly ok: true; readonly persisted: false }
  | { readonly ok: false; readonly error: string }

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for very old runtimes — good enough for a client-generated id.
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`
}

export function usePartnerApplicationCreation() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const client = useMemo(() => {
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [config])

  const createPartnerApplication = useCallback(
    async (
      draft: PartnerApplicationDraft,
    ): Promise<PartnerApplicationCreationResult> => {
      if (!client) {
        // Supabase not configured (local/dev preview): report success without
        // persistence so the funnel is still demoable.
        return { ok: true, persisted: false }
      }

      try {
        const application = await createPartnerApplicationInSupabase({
          client,
          draft,
          id: newId(),
          attribution: getAttributionFields(Date.now()),
        })

        // Fire-and-forget admin + candidate emails. The application is already
        // persisted — any email pipeline failure is logged server-side only.
        void sendPartnerApplicationNotification({
          data: { partnerApplicationId: application.id },
        }).catch((error) => {
          console.error('sendPartnerApplicationNotification failed', error)
        })

        return { ok: true, persisted: true, application }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Envoi de la candidature impossible',
        }
      }
    },
    [client],
  )

  return {
    isConfigured: config.isConfigured,
    createPartnerApplication,
  }
}
