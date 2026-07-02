// Admin-grade partner-applications repository. Lists ALL applications and
// performs status transitions + admin_notes via UPDATE. RLS policy
// `Admins manage partner applications` restricts these calls to
// admin/super_admin profiles.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  Database,
  PartnerApplicationStatus,
  PartnerTargetStatus,
} from '@/lib/supabase/types'

export type PartnerApplicationAdminClient = SupabaseBrowserClient

type PartnerApplicationRow =
  Database['public']['Tables']['partner_applications']['Row']

export interface PartnerApplicationAdminRow {
  readonly id: string
  readonly status: PartnerApplicationStatus
  readonly companyName: string
  readonly siret: string
  readonly siretVerified: boolean
  readonly contactName: string
  readonly email: string
  readonly phone: string | null
  readonly activityProfile: string
  readonly targetStatus: PartnerTargetStatus
  readonly zone: string | null
  readonly estimatedVolume: string | null
  readonly message: string | null
  readonly utmSource: string | null
  readonly utmMedium: string | null
  readonly utmCampaign: string | null
  readonly partnerRef: string | null
  readonly adminNotes: string | null
  readonly createdAt: string
}

function toAdminRow(row: PartnerApplicationRow): PartnerApplicationAdminRow {
  return {
    id: row.id,
    status: row.status,
    companyName: row.company_name,
    siret: row.siret,
    siretVerified: row.siret_verified,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    activityProfile: row.activity_profile,
    targetStatus: row.target_status,
    zone: row.zone,
    estimatedVolume: row.estimated_volume,
    message: row.message,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    partnerRef: row.partner_ref,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
  }
}

export async function listAllPartnerApplications(
  client: PartnerApplicationAdminClient,
): Promise<ReadonlyArray<PartnerApplicationAdminRow>> {
  const { data, error } = await client
    .from('partner_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<PartnerApplicationRow>).map(toAdminRow)
}

export async function updatePartnerApplicationStatus(
  client: PartnerApplicationAdminClient,
  id: string,
  status: PartnerApplicationStatus,
): Promise<void> {
  const { error } = await client
    .from('partner_applications')
    .update({ status } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updatePartnerApplicationAdminNotes(
  client: PartnerApplicationAdminClient,
  id: string,
  adminNotes: string | null,
): Promise<void> {
  const { error } = await client
    .from('partner_applications')
    .update({ admin_notes: adminNotes } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}
