import { useCallback, useMemo } from 'react'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import {
  verifySiretWithEdgeFunction,
  type RemoteSiretVerificationResult,
} from '@/lib/validation/siret-verification'

export function useSiretVerification() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const client = useMemo(() => {
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [config])

  const verify = useCallback(
    (siret: string): Promise<RemoteSiretVerificationResult> =>
      verifySiretWithEdgeFunction({ siret, client }),
    [client],
  )

  return {
    isConfigured: config.isConfigured,
    verify,
  }
}
