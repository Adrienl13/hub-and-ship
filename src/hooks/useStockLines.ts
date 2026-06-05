// DB-first stock 24h reader. Goes to `public.stock_lines` (public RLS
// allows anon SELECT on active rows) and falls back to the in-repo
// fixture when Supabase isn't configured or the table is empty — so
// the catalogue keeps rendering during local dev and in any future
// degraded mode.

import { useEffect, useMemo, useState } from 'react'

import { useCatalog } from '@/hooks/useCatalog'
import {
  AVAILABLE_STOCK,
  getAvailableStockLines,
  type StockLine,
} from '@/lib/stock'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Database, StockCondition } from '@/lib/supabase/types'

type StockLineRow = Database['public']['Tables']['stock_lines']['Row']

interface UseStockLinesResult {
  readonly lines: ReadonlyArray<StockLine>
  readonly source: 'db' | 'fixture'
  readonly loading: boolean
}

function rowToLine(
  row: StockLineRow,
  products: ReturnType<typeof useCatalog>['products'],
): StockLine | null {
  const product = products.find((p) => p.id === row.product_id)
  if (!product) return null
  const variant = product.variants.find((v) => v.id === row.variant_id)
  if (!variant) return null
  return {
    id: row.id,
    product,
    variant,
    availableUnits: row.available_units,
    reservedUnits: row.reserved_units,
    stockPriceHt: Number(row.stock_price_ht),
    location: row.location,
    readyLabel: row.ready_label,
    condition: row.condition as StockCondition,
    priority: row.priority,
    note: row.note,
    imageUrl: row.image_url ?? null,
    imageUrls: row.image_urls ?? [],
  }
}

export function useStockLines(): UseStockLinesResult {
  const { products } = useCatalog()
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [rows, setRows] = useState<ReadonlyArray<StockLineRow> | null>(null)
  const [loading, setLoading] = useState(config.isConfigured)
  // Bumped on tab focus so an admin edit shows up without a full browser
  // reload (the fetch is otherwise a load-once snapshot).
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!config.isConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const client = createSupabaseBrowserClient(config)
    void client
      .from('stock_lines')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        setRows(error || !data ? null : (data as ReadonlyArray<StockLineRow>))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, refreshTick])

  useEffect(() => {
    function refetchIfVisible() {
      if (document.visibilityState === 'visible') {
        setRefreshTick((tick) => tick + 1)
      }
    }
    window.addEventListener('focus', refetchIfVisible)
    document.addEventListener('visibilitychange', refetchIfVisible)
    return () => {
      window.removeEventListener('focus', refetchIfVisible)
      document.removeEventListener('visibilitychange', refetchIfVisible)
    }
  }, [])

  // Map raw rows against the live catalogue. Kept separate from the network
  // fetch so a product refresh only re-maps (cheap) instead of re-querying.
  const dbLines = useMemo(
    () =>
      rows
        ? rows
            .map((row) => rowToLine(row, products))
            .filter((line): line is StockLine => line !== null)
        : null,
    [rows, products],
  )

  const fallback = useMemo(() => getAvailableStockLines(AVAILABLE_STOCK), [])

  if (dbLines && dbLines.length > 0) {
    return { lines: dbLines, source: 'db', loading: false }
  }
  return { lines: fallback, source: 'fixture', loading }
}
