import { memo, useMemo } from 'react'
import { Info } from 'lucide-react'

import { MoqProgressBar } from '@/components/MoqProgressBar'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DesignSelector } from '@/components/DesignSelector'
import { Button } from '@/components/ui/button'
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
      className="shadow-paper group relative isolate flex min-h-[530px] overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--ink)]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '530px' }}
    >
      <button
        type="button"
        onClick={onOpenDetails}
        className="absolute inset-0 z-0 block overflow-hidden bg-[color:var(--sand)] text-left"
        aria-label={`Voir détails ${product.name}`}
      >
        <img
          src={product.mainImageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </button>

      {onToggleCompare && (
        <button
          type="button"
          onClick={onToggleCompare}
          aria-pressed={compareSelected}
          className={`absolute left-3 top-3 z-20 inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-[11px] font-medium backdrop-blur ${
            compareSelected
              ? 'border-[color:var(--ember)] bg-[color:var(--ember)] text-white'
              : 'border-white/60 bg-black/40 text-white hover:bg-black/55'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 rounded-[2px] border ${
              compareSelected
                ? 'border-white bg-white'
                : 'border-white/80 bg-transparent'
            }`}
          />
          Comparer
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-black/5 to-black/70" />

      <div className="relative z-20 flex min-h-[530px] w-full flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-sm bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-sm backdrop-blur">
            {CATEGORY_LABEL[product.category]}
          </span>

          <div className="rounded-sm bg-white/95 px-2.5 py-2 text-right text-[color:var(--ink)] shadow-sm backdrop-blur">
            <div className="font-display text-lg font-semibold tabular-nums">
              {formatEUR(product.basePriceHt)}
            </div>
            <div className="text-[10px] tabular-nums text-[color:var(--ink-soft)]">
              <span className="line-through">
                {formatEUR(product.retailPriceRef)}
              </span>
              <span className="ml-1 font-semibold text-[color:var(--ember)]">
                -{savingsPct}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card/95 rounded-md border border-white/40 p-3 text-foreground shadow-sm backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={onOpenDetails}
              className="group/name flex min-w-0 items-start gap-1.5 text-left"
            >
              <span className="min-w-0 font-display text-lg font-semibold leading-tight tracking-tight">
                {product.name}
              </span>
              <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover/name:text-foreground" />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>{product.sku}</span>
            <span>
              {product.dimensions.l}×{product.dimensions.w}×
              {product.dimensions.h} cm
            </span>
            <span>{product.cbmPerUnit.toFixed(2)} m³/u</span>
            <span>MOQ {product.moqUnits}</span>
          </div>

          <div className="mt-3">
            <DesignSelector
              variants={product.variants}
              selectedVariantId={variantId}
              onChange={onVariantChange}
              showLabel={false}
              fallbackImageUrl={product.mainImageUrl}
            />
          </div>

          <div className="mt-3">
            <MoqProgressBar label={`MOQ ${variant?.name}`} status={moqStatus} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <QuantityStepper
              value={qty}
              onChange={onQtyChange}
              rule={quantityRule}
              showRule={product.category === 'chair'}
            />
            <Button
              variant="outline"
              className="h-9 rounded-sm border-[color:var(--sand-deep)] px-3 text-xs"
              onClick={onOpenDetails}
            >
              Détails
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

export const ProductCard = memo(ProductCardComponent)
