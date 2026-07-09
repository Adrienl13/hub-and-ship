import { memo, useMemo, type MouseEvent } from 'react'
import { Heart, Info, Scale } from 'lucide-react'

import { MoqProgressBar } from '@/components/MoqProgressBar'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DesignSelector } from '@/components/DesignSelector'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import { formatEUR, getMoqStatus } from '@/lib/order'
import { getQuantityRule } from '@/lib/quantity'
import { Button } from '@/components/ui/button'
import { productPath } from '@/lib/product-slugs'

const CATEGORY_QUICK_RESERVE_LABEL: Record<Product['category'], string> = {
  chair: 'chaises',
  armchair: 'fauteuil',
  table: 'table',
  bench: 'banc',
}

function ProductCardComponent({
  product,
  variantId,
  qty,
  onQtyChange,
  onVariantChange,
  onOpenDetails,
  onQuickReserve,
  compareSelected,
  onToggleCompare,
  isFavorite,
  onToggleFavorite,
}: {
  product: Product
  variantId: string
  qty: number
  onQtyChange: (value: number) => void
  onVariantChange: (id: string) => void
  onOpenDetails?: () => void
  onQuickReserve?: () => void
  compareSelected?: boolean
  onToggleCompare?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
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
  const hasMultipleDesigns = product.variants.length > 1
  const quickReserveLabel =
    qty > 0
      ? 'Réserver maintenant'
      : `Réserver ${quantityRule.minimum} ${CATEGORY_QUICK_RESERVE_LABEL[product.category]}`
  const detailsHref = productPath(product)
  const handleDetailsClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpenDetails) return
    event.preventDefault()
    onOpenDetails()
  }

  return (
    <article
      id={`produit-${product.id}`}
      data-catalog-item-mode="portrait-card"
      className="shadow-paper group flex flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '520px' }}
    >
      {/* Visuel produit plein, non recouvert */}
      <div className="relative">
        <a
          href={detailsHref}
          onClick={handleDetailsClick}
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
        </a>

        <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-sm backdrop-blur">
          {CATEGORY_LABEL[product.category]}
        </span>

        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
            }
            className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/80 backdrop-blur transition-colors hover:bg-white"
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorite
                  ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
                  : 'text-[color:var(--ink)]/60'
              }`}
            />
          </button>
        )}

        {onToggleCompare && (
          <button
            type="button"
            onClick={onToggleCompare}
            aria-pressed={compareSelected}
            aria-label={
              compareSelected
                ? `Retirer ${product.name} du comparateur`
                : `Comparer ${product.name}`
            }
            title="Comparer"
            className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-colors ${
              compareSelected
                ? 'border-[color:var(--ember)] bg-[color:var(--ember)] text-white'
                : 'text-[color:var(--ink)]/55 border-white/70 bg-white/75 hover:bg-white hover:text-[color:var(--ink)]'
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Infos & contrôles sous le visuel — compact pour une grille scannable */}
      <div className="flex flex-1 flex-col p-2.5 text-foreground">
        <div className="flex items-start justify-between gap-2">
          <a
            href={detailsHref}
            onClick={handleDetailsClick}
            className="group/name flex min-w-0 items-start gap-1 text-left"
          >
            <span className="line-clamp-2 min-w-0 font-display text-sm font-semibold leading-tight tracking-tight">
              {product.name}
            </span>
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover/name:text-foreground" />
          </a>

          <div className="shrink-0 text-right">
            <div className="font-display text-base font-semibold tabular-nums">
              {formatEUR(product.basePriceHt)}
            </div>
            <div className="text-[10px] font-semibold tabular-nums text-[color:var(--ember)]">
              -{savingsPct}%
            </div>
          </div>
        </div>

        {hasMultipleDesigns && (
          <div className="mt-2">
            <DesignSelector
              variants={product.variants}
              selectedVariantId={variantId}
              onChange={onVariantChange}
              showLabel={false}
              fallbackImageUrl={product.mainImageUrl}
            />
          </div>
        )}

        <div className="mt-2">
          <MoqProgressBar
            label={hasMultipleDesigns ? `MOQ ${variant?.name}` : 'MOQ'}
            status={moqStatus}
          />
        </div>

        <div className="mt-auto pt-2.5">
          <QuantityStepper
            value={qty}
            onChange={onQtyChange}
            rule={quantityRule}
            showRule={false}
          />
          {qty > 0 && (
            <div className="mt-1 text-center text-[10px] font-medium text-emerald-700">
              {qty} ajoutée{qty > 1 ? 's' : ''} au panier
            </div>
          )}
          {onQuickReserve && (
            <Button
              type="button"
              className="mt-2 h-9 w-full rounded-sm bg-[color:var(--foreground)] text-xs text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
              onClick={onQuickReserve}
            >
              {quickReserveLabel}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

export const ProductCard = memo(ProductCardComponent)
