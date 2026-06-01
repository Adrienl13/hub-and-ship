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
  const [dbLines, setDbLines] = useState<ReadonlyArray<StockLine> | null>(null)
  const [loading, setLoading] = useState(config.isConfigured)

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
        if (error || !data) {
          setDbLines(null)
        } else {
          const mapped = (data as ReadonlyArray<StockLineRow>)
            .map((row) => rowToLine(row, products))
            .filter((line): line is StockLine => line !== null)
          setDbLines(mapped)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, products])

  const fallback = useMemo(
    () => getAvailableStockLines(AVAILABLE_STOCK),
    [],
  )

  if (dbLines && dbLines.length > 0) {
    return { lines: dbLines, source: 'db', loading: false }
  }
  return { lines: fallback, source: 'fixture', loading }
}
