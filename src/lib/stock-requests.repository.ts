import type {
  StockRequestDraft,
  StockRequestInsertPayload,
} from '@/lib/stock-requests'
import { toStockRequestInsertPayload } from '@/lib/stock-requests'
import type { Database } from '@/lib/supabase/types'

type StockRequestCreatedRow = Pick<
  Database['public']['Tables']['stock_requests']['Row'],
  'id' | 'status'
>

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

export interface StockRequestRepositoryClient {
  from: (table: 'stock_requests') => {
    insert: (payload: StockRequestInsertPayload) => {
      select: (columns: 'id, status') => {
        single: () => PromiseLike<RepositoryResult<StockRequestCreatedRow>>
      }
    }
  }
}

export interface CreateStockRequestResult {
  readonly id: string
  readonly status: StockRequestCreatedRow['status']
}

export async function createStockRequestInSupabase({
  client,
  draft,
}: {
  readonly client: StockRequestRepositoryClient
  readonly draft: StockRequestDraft
}): Promise<CreateStockRequestResult> {
  const result = await client
    .from('stock_requests')
    .insert(toStockRequestInsertPayload(draft))
    .select('id, status')
    .single()

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'Stock request insert failed')
  }

  return result.data
}
