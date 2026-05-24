import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatEUR } from '@/lib/order'
import { ContainerFillBar } from '@/components/ContainerFillBar'
import { CURRENT_CONTAINER, type ContainerSummary } from '@/lib/products'

export function MobileStickyBar({
  totalItems,
  fillPercent,
  subtotalHt,
  onReserve,
  container = CURRENT_CONTAINER,
}: {
  totalItems: number
  fillPercent: number
  subtotalHt: number
  onReserve: () => void
  container?: ContainerSummary
}) {
  if (totalItems <= 0) return null
  return (
    <div className="bg-[color:var(--sand-soft)]/95 sticky bottom-0 z-30 border-t border-[color:var(--sand-deep)] px-4 py-2.5 backdrop-blur lg:hidden">
      <div className="mx-auto max-w-7xl">
        <ContainerFillBar
          percent={fillPercent}
          usedCbm={0}
          capacity={container.capacityCbm}
          thresholdPercent={container.thresholdPercent}
          compact
        />
        <div className="mt-2 flex items-center gap-3">
          <div className="min-w-0 flex-1 text-[11px] leading-tight">
            <div className="font-medium tabular-nums">
              {totalItems} produits
            </div>
            <div className="tabular-nums text-muted-foreground">
              {formatEUR(subtotalHt)} HT
            </div>
          </div>
          <Button
            size="sm"
            className="h-10 shrink-0 rounded-sm bg-[color:var(--foreground)] px-4 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            onClick={onReserve}
          >
            Réserver <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
