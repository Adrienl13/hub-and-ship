// Admin-grade companies repository. Lists all companies and sets the sales
// channel. The `companies` RLS policy "Admins full access companies" restricts
// these calls to admin/super_admin, and the `enforce_company_channel_admin_only`
// trigger both re-checks admin status and auto-stamps channel_set_by/at.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database, SalesChannel } from '@/lib/supabase/types'

export type CompanyAdminClient = SupabaseBrowserClient

type CompanyRow = Database['public']['Tables']['companies']['Row']

export interface CompanyAdminRow {
  readonly id: string
  readonly legalName: string
  readonly tradingName: string | null
  readonly siret: string | null
  readonly channel: SalesChannel
  readonly channelSetAt: string | null
  readonly isVerified: boolean
  readonly createdAt: string
}

function toAdminRow(row: CompanyRow): CompanyAdminRow {
  return {
    id: row.id,
    legalName: row.legal_name,
    tradingName: row.trading_name,
    siret: row.siret,
    channel: row.channel,
    channelSetAt: row.channel_set_at,
    isVerified: row.is_verified,
    createdAt: row.created_at,
  }
}

export async function listAllCompanies(
  client: CompanyAdminClient,
): Promise<ReadonlyArray<CompanyAdminRow>> {
  const { data, error } = await client
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<CompanyRow>).map(toAdminRow)
}

export async function updateCompanyChannel(
  client: CompanyAdminClient,
  id: string,
  channel: SalesChannel,
): Promise<void> {
  const { error } = await client
    .from('companies')
    .update({ channel } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}
