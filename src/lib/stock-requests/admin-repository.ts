// Admin-grade stock-requests repository. Lists ALL stock requests
// (including non-new) and performs status transitions via UPDATE.
// RLS policy `Admins full access stock requests` restricts these calls
// to admin/super_admin profiles.

import { describeOrigin, stockRequestSourceLabel } from '@/lib/admin/origin'
import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database, StockRequestStatus } from '@/lib/supabase/types'

export type StockRequestAdminClient = SupabaseBrowserClient

type StockRequestRow = Database['public']['Tables']['stock_requests']['Row']
type StockRequestUpdate =
  Database['public']['Tables']['stock_requests']['Update']

export interface StockRequestAdminRow {
  readonly id: string
  readonly status: StockRequestStatus
  readonly stockLineId: string
  readonly productName: string
  readonly sku: string
  readonly variantName: string
  readonly requestedQuantity: number
  readonly availableUnitsSnapshot: number
  readonly estimatedTotalHt: number
  readonly companyName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly location: string
  readonly customerNote: string | null
  readonly internalNote: string | null
  /** Point de capture (stock_24h_page, catalogue…). */
  readonly source: string
  readonly utmSource: string | null
  readonly utmMedium: string | null
  readonly utmCampaign: string | null
  readonly partnerRef: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Origine lisible d'une demande : partenaire (?ref=), puis UTM, sinon le
 * libellé de la source de capture (« Page stock 24h »), sinon « Direct ».
 * Helper commun dans lib/admin/origin.ts ; sert à la ligne admin et au CSV.
 */
export function describeStockRequestOrigin(
  row: Pick<
    StockRequestAdminRow,
    'source' | 'utmSource' | 'utmMedium' | 'utmCampaign' | 'partnerRef'
  >,
): string {
  return describeOrigin({
    partnerRef: row.partnerRef,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    sourceLabel: stockRequestSourceLabel(row.source),
  })
}

export function toStockRequestAdminRow(
  row: StockRequestRow,
): StockRequestAdminRow {
  return {
    id: row.id,
    status: row.status,
    stockLineId: row.stock_line_id,
    productName: row.product_name,
    sku: row.sku,
    variantName: row.variant_name,
    requestedQuantity: row.requested_quantity,
    availableUnitsSnapshot: row.available_units_snapshot,
    estimatedTotalHt: Number(row.estimated_total_ht),
    companyName: row.company_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    location: row.location,
    customerNote: row.customer_note,
    internalNote: row.internal_note,
    source: typeof row.source === 'string' ? row.source : '',
    utmSource: toNullableString(row.utm_source),
    utmMedium: toNullableString(row.utm_medium),
    utmCampaign: toNullableString(row.utm_campaign),
    partnerRef: toNullableString(row.partner_ref),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAllStockRequests(
  client: StockRequestAdminClient,
): Promise<ReadonlyArray<StockRequestAdminRow>> {
  const { data, error } = await client
    .from('stock_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<StockRequestRow>).map(
    toStockRequestAdminRow,
  )
}

export async function updateStockRequestStatus(
  client: StockRequestAdminClient,
  id: string,
  status: StockRequestStatus,
  internalNote?: string | null,
): Promise<void> {
  const payload: StockRequestUpdate = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (internalNote !== undefined) {
    payload.internal_note = internalNote
  }
  const { error } = await client
    .from('stock_requests')
    .update(payload as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updateStockRequestInternalNote(
  client: StockRequestAdminClient,
  id: string,
  internalNote: string | null,
): Promise<void> {
  const { error } = await client
    .from('stock_requests')
    .update({
      internal_note: internalNote,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}
