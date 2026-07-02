import {
  EMPTY_ATTRIBUTION,
  type AttributionFields,
} from '@/lib/analytics/attribution'
import {
  toPartnerApplicationInsertPayload,
  type PartnerApplicationDraft,
  type PartnerApplicationInsertPayload,
} from '@/lib/partner-applications'
import type { PartnerApplicationStatus } from '@/lib/supabase/types'

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

export interface PartnerApplicationRepositoryClient {
  from: (table: 'partner_applications') => {
    insert: (
      payload: PartnerApplicationInsertPayload,
    ) => PromiseLike<RepositoryResult<null>>
  }
}

export interface CreatePartnerApplicationResult {
  readonly id: string
  readonly status: PartnerApplicationStatus
}

export async function createPartnerApplicationInSupabase({
  client,
  draft,
  id,
  attribution = EMPTY_ATTRIBUTION,
}: {
  readonly client: PartnerApplicationRepositoryClient
  readonly draft: PartnerApplicationDraft
  readonly id: string
  readonly attribution?: AttributionFields
}): Promise<CreatePartnerApplicationResult> {
  // Write-only for anon (no SELECT policy), so we cannot ".select()" the row
  // back. The id is generated client-side and reused by the email server fn to
  // re-fetch the row via the service-role client. First-touch attribution
  // (utm_* / partner_ref) is merged onto the row.
  const result = await client.from('partner_applications').insert({
    id,
    ...toPartnerApplicationInsertPayload(draft),
    ...attribution,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  return { id, status: draft.status }
}
