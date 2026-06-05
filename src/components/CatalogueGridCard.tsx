import { Plus } from 'lucide-react'
import { memo, useMemo } from 'react'

import { MoqProgressBar } from '@/components/MoqProgressBar'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import { formatEUR, getMoqStatus } from '@/lib/order'
import { getNextOrderQuantity, getQuantityRule } from '@/lib/quantity'

// Lightweight "browse" card for the catalogue grid. Unlike <ProductCard>
// (used on the home page), this card stays airy: a large hero image plus the
// three at-a-glance purchase signals — price, discount, MOQ progress.
//
// The image + title area opens the detail dialog (to pick a design / read
// specs), but the footer carries a direct add-to-container control so users
// can fill their container without opening every product. The control is a
// single "Ajouter" button until the item is in the cart, then it reveals the
// quantity stepper — progressive disclosure keeps the browsing wall light.
function CatalogueGridCardComponent({
  product,
  variantId,
  qty,
  onQtyChange,
  onOpenDetails,
}: {
  product: Product
  variantId: string
  qty: number
  onQtyChange: (value: number) => void
  onOpenDetails: () => void
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
  const quantityRule = getQuantityRule(product)
  const moqStatus = getMoqStatus(
    (variant?.unitsCommitted ?? 0) + qty,
    product.moqUnits,
  )

  return (
    <article className="flex flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onOpenDetails}
        className="group/card block w-full text-left"
        aria-label={`Voir détails ${product.name}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[color:var(--sand)]">
          <img
            src={product.mainImageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover/card:scale-105"
          />
          <span className="bg-[color:var(--sand-soft)]/90 absolute left-2.5 top-2.5 rounded-sm px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur">
            {CATEGORY_LABEL[product.category]}
          </span>
          {savingsPct > 0 && (
            <span className="absolute right-2.5 top-2.5 rounded-sm bg-[color:var(--ember)] px-2 py-1 text-[10px] font-semibold text-white">
              -{savingsPct}%
            </span>
          )}
        </div>
        <div className="space-y-2 p-3 pb-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold leading-tight tracking-tight">
              {product.name}
            </h3>
            <span className="shrink-0 font-display text-base font-semibold tabular-nums">
              {formatEUR(product.basePriceHt)}
            </span>
          </div>
          <MoqProgressBar label={`MOQ ${product.moqUnits}`} status={moqStatus} />
        </div>
      </button>

      <div className="mt-auto p-3 pt-2.5">
        {qty === 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full gap-1.5 rounded-sm border-[color:var(--sand-deep)]"
            onClick={() => onQtyChange(getNextOrderQuantity(0, quantityRule))}
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <QuantityStepper
              value={qty}
              onChange={onQtyChange}
              rule={quantityRule}
              showRule={product.category === 'chair'}
            />
            <span className="shrink-0 text-[10px] font-medium text-[color:var(--forest)]">
              au container
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

export const CatalogueGridCard = memo(CatalogueGridCardComponent)
