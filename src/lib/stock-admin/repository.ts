// Admin repository for the warehouse stock 24h inventory.
//
// RLS on `public.stock_lines` lets only admins write; reads stay
// public so the catalogue (/stock-24h) can render anonymously. The
// `Admins write stock lines` policy gates everything below — no
// service-role here, the browser session carries the right.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database, StockCondition } from '@/lib/supabase/types'

export type StockAdminClient = SupabaseBrowserClient

type StockLineRow = Database['public']['Tables']['stock_lines']['Row']
type StockLineInsert = Database['public']['Tables']['stock_lines']['Insert']
type StockLineUpdate = Database['public']['Tables']['stock_lines']['Update']

export interface AdminStockLineRow {
  readonly id: string
  readonly productId: string
  readonly variantId: string
  readonly availableUnits: number
  readonly reservedUnits: number
  readonly stockPriceHt: number
  readonly location: string
  readonly readyLabel: string
  readonly condition: StockCondition
  readonly priority: number
  readonly note: string
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

function toAdminRow(row: StockLineRow): AdminStockLineRow {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    availableUnits: row.available_units,
    reservedUnits: row.reserved_units,
    stockPriceHt: Number(row.stock_price_ht),
    location: row.location,
    readyLabel: row.ready_label,
    condition: row.condition,
    priority: row.priority,
    note: row.note,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAllStockLines(
  client: StockAdminClient,
): Promise<ReadonlyArray<AdminStockLineRow>> {
  const { data, error } = await client
    .from('stock_lines')
    .select('*')
    .order('priority', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<StockLineRow>).map(toAdminRow)
}

export async function upsertStockLine(
  client: StockAdminClient,
  payload: StockLineInsert,
): Promise<void> {
  const { error } = await client
    .from('stock_lines')
    .upsert(payload as never, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function updateStockLine(
  client: StockAdminClient,
  id: string,
  payload: StockLineUpdate,
): Promise<void> {
  const { error } = await client
    .from('stock_lines')
    .update(payload as never)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deactivateStockLine(
  client: StockAdminClient,
  id: string,
): Promise<void> {
  await updateStockLine(client, id, { is_active: false })
}

export async function reactivateStockLine(
  client: StockAdminClient,
  id: string,
): Promise<void> {
  await updateStockLine(client, id, { is_active: true })
}
