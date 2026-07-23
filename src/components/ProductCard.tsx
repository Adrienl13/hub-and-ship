import { memo, useMemo } from 'react'
import { Check, Heart, Info } from 'lucide-react'

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
  isFavorite,
  onToggleFavorite,
}: {
  product: Product
  variantId: string
  qty: number
  onQtyChange: (value: number) => void
  onVariantChange: (id: string) => void
  onOpenDetails?: () => void
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

      {/* Infos & contrôles sous le visuel — zones à hauteur FIXE pour que
          prix, sélecteur et barre MOQ s'alignent d'une carte à l'autre,
          quelle que soit la longueur du nom. */}
      <div className="flex flex-1 flex-col p-2.5 text-foreground">
        <button
          type="button"
          onClick={onOpenDetails}
          className="group/name flex min-w-0 items-start gap-1 text-left"
        >
          <span className="line-clamp-2 min-h-[2.15em] min-w-0 font-display text-sm font-semibold leading-tight tracking-tight">
            {product.name}
          </span>
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover/name:text-foreground" />
        </button>

        <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-[color:var(--sand-deep)] pt-1.5">
          <span className="font-display text-base font-extrabold tabular-nums">
            {formatEUR(product.basePriceHt)}
            <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
              HT
            </span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[11px] tabular-nums text-muted-foreground line-through">
              {formatEUR(product.retailPriceRef)}
            </span>
            <span className="rounded-sm bg-[color:var(--forest-bg)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[color:var(--forest)]">
              −{savingsPct}%
            </span>
          </span>
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
          {/* Confirmation visible : la quantité est déjà comptée dans la
              commande — sans cet état, l'acheteur doute et recommence. */}
          <div
            className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${
              qty > 0 ? 'text-[color:var(--forest)]' : 'invisible'
            }`}
            aria-hidden={qty === 0}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            Dans votre commande — total mis à jour
          </div>
        </div>
      </div>
    </article>
  )
}

export const ProductCard = memo(ProductCardComponent)
