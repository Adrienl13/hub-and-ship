// Détails d'une assise dans le Studio (lot 2) : réutilise la galerie, le
// sélecteur de design et les specs du catalogue, sans stepper ni logique
// commerciale recopiée. Le prix n'apparaît qu'à l'étape des finalistes ou
// du projet (showPrice), jamais pendant la découverte.

import { Check, Heart, Ruler, ShieldCheck, Weight } from 'lucide-react'
import { useState } from 'react'

import { DesignSelector } from '@/components/DesignSelector'
import { ProductGallery } from '@/components/ProductGallery'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatEUR } from '@/lib/order'
import { formatProductDimensions } from '@/lib/products'
import { materialLabel, seatKindLabel } from '@/lib/studio/labels'
import type { StudioProduct } from '@/lib/studio/types'

export function StudioProductDetails({
  product,
  open,
  onOpenChange,
  showPrice = false,
  isFavorite = false,
  onToggleFavorite,
  onChoose,
  initialVariantId,
}: {
  readonly product: StudioProduct | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly showPrice?: boolean
  readonly isFavorite?: boolean
  readonly onToggleFavorite?: (productId: string) => void
  /** Choix EXPLICITE : « Choisir cette assise » (design sélectionné). */
  readonly onChoose?: (productId: string, variantId: string) => void
  readonly initialVariantId?: string
}) {
  const [variantId, setVariantId] = useState<string | null>(null)
  if (!product) return null
  const variant =
    product.variants.find((entry) => entry.id === (variantId ?? initialVariantId)) ?? product.variants[0]
  if (!variant) return null
  const kind = seatKindLabel(product.studio.seatKind)
  const material = materialLabel(product.studio.material)
  const { l, w, h } = product.dimensions

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&_button]:min-h-[44px] [&_button]:min-w-[44px] [&>button]:flex [&>button]:items-center [&>button]:justify-center motion-reduce:animate-none motion-reduce:transition-none [&_*]:motion-reduce:transition-none [&_*]:motion-reduce:transform-none max-h-[92vh] overflow-y-auto bg-[color:var(--sand-soft)] sm:max-w-3xl">
        <DialogHeader className="pr-12">
          <div className="label-eyebrow text-[color:var(--ink-soft)]">
            {[kind, material].filter(Boolean).join(' · ') || 'Assise'} · {product.sku}
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">{product.name}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
            {product.description || 'Fiche en cours de complétion.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <ProductGallery product={product} design={variant} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              {l > 0 && w > 0 && h > 0 && (
                <Spec Icon={Ruler} label="Dimensions" value={formatProductDimensions(product)} />
              )}
              {product.weightKg > 0 && <Spec Icon={Weight} label="Poids" value={`${product.weightKg} kg`} />}
              <Spec Icon={ShieldCheck} label="Minimum de série" value={`${product.moqUnits} unités (indicatif)`} />
              {product.fireRating && <Spec Icon={ShieldCheck} label="Classement feu" value={product.fireRating} />}
            </div>
          </div>

          <div className="space-y-4">
            {showPrice && (
              <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-4">
                <div className="font-display text-3xl font-semibold tabular-nums">
                  {formatEUR(product.basePriceHt)}
                </div>
                <div className="text-xs text-[color:var(--ink-soft)]">HT par unité, prix public</div>
              </div>
            )}
            <DesignSelector
              variants={product.variants}
              selectedVariantId={variant.id}
              onChange={setVariantId}
              size="lg"
              fallbackImageUrl={product.mainImageUrl}
            />
            {product.features.length > 0 && (
              <div>
                <div className="label-eyebrow mb-1.5 text-[color:var(--ink-soft)]">Caractéristiques</div>
                <ul className="grid grid-cols-1 gap-1 text-xs">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--forest)]" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(product.id)}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] px-4 text-sm font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                >
                  <Heart
                    className={`h-4 w-4 ${isFavorite ? 'fill-[color:var(--ember)] text-[color:var(--ember)]' : ''}`}
                    aria-hidden
                  />
                  {isFavorite ? 'Dans vos favoris' : 'Ajouter aux favoris'}
                </button>
              )}
              {onChoose && (
                <button
                  type="button"
                  onClick={() => onChoose(product.id, variant.id)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-[color:var(--ember)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--ember-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                >
                  Choisir cette assise
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Spec({ Icon, label, value }: { Icon: typeof Ruler; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-2.5">
      <div className="label-eyebrow flex items-center gap-1 text-[color:var(--ink-soft)]">
        <Icon className="h-3 w-3" aria-hidden /> {label}
      </div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
}
