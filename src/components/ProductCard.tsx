import { memo, useMemo } from 'react'
import { Info } from 'lucide-react'

import { MoqProgressBar } from '@/components/MoqProgressBar'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DesignSelector } from '@/components/DesignSelector'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import { formatEUR, getMoqStatus } from '@/lib/order'
import { getQuantityRule } from '@/lib/quantity'

function ProductCardComponent({
  product,
  variantId,
  qty,
  onQtyChange,
  onVariantChange,
  onOpenDetails,
  compareSelected,
  onToggleCompare,
}: {
  product: Product
  variantId: string
  qty: number
  onQtyChange: (value: number) => void
  onVariantChange: (id: string) => void
  onOpenDetails?: () => void
  compareSelected?: boolean
  onToggleCompare?: () => void
}) {
  const variant = useMemo(
    () =>
      product.variants.find((item) => item.id === variantId) ??
      product.variants[0],
    [product.variants, variantId],
  )
  const savingsPct = Math.round(
    (1 - product.basePriceHt / product.retailPriceRef) * 100,
  )
  const totalCommitted = (variant?.unitsCommitted ?? 0) + qty
  const moqStatus = getMoqStatus(totalCommitted, product.moqUnits)
  const quantityRule = getQuantityRule(product)

  return (
    <article
      data-catalog-item-mode="portrait-card"
      className="shadow-paper group flex flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '520px' }}
    >
      {/* Visuel produit plein, non recouvert */}
      <div className="relative">
        <button
          type="button"
          onClick={onOpenDetails}
          className="block aspect-square w-full overflow-hidden bg-[color:var(--sand)] text-left"
          aria-label={`Voir détails ${product.name}`}
        >
          <img
            src={product.mainImageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </button>

        <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-sm backdrop-blur">
          {CATEGORY_LABEL[product.category]}
        </span>

        {onToggleCompare && (
          <button
            type="button"
            onClick={onToggleCompare}
            aria-pressed={compareSelected}
            className={`absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-[11px] font-medium backdrop-blur ${
              compareSelected
                ? 'border-[color:var(--ember)] bg-[color:var(--ember)] text-white'
                : 'border-white/70 bg-white/70 text-[color:var(--ink)] hover:bg-white/90'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-[2px] border ${
                compareSelected
                  ? 'border-white bg-white'
                  : 'border-[color:var(--ink)]/50 bg-transparent'
              }`}
            />
            Comparer
          </button>
        )}
      </div>

      {/* Infos & contrôles sous le visuel — compact pour une grille scannable */}
      <div className="flex flex-1 flex-col p-2.5 text-foreground">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onOpenDetails}
            className="group/name flex min-w-0 items-start gap-1 text-left"
          >
            <span className="line-clamp-2 min-w-0 font-display text-sm font-semibold leading-tight tracking-tight">
              {product.name}
            </span>
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover/name:text-foreground" />
          </button>

          <div className="shrink-0 text-right">
            <div className="font-display text-base font-semibold tabular-nums">
              {formatEUR(product.basePriceHt)}
            </div>
            <div className="text-[10px] font-semibold tabular-nums text-[color:var(--ember)]">
              -{savingsPct}%
            </div>
          </div>
        </div>

        <div className="mt-2">
          <DesignSelector
            variants={product.variants}
            selectedVariantId={variantId}
            onChange={onVariantChange}
            showLabel={false}
            fallbackImageUrl={product.mainImageUrl}
          />
        </div>

        <div className="mt-2">
          <MoqProgressBar label={`MOQ ${variant?.name}`} status={moqStatus} />
        </div>

        <div className="mt-auto pt-2.5">
          <QuantityStepper
            value={qty}
            onChange={onQtyChange}
            rule={quantityRule}
            showRule={false}
          />
        </div>
      </div>
    </article>
  )
}

export const ProductCard = memo(ProductCardComponent)
