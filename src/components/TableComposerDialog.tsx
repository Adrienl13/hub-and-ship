import { useEffect, useMemo, useState } from 'react'
import { Check, Layers3, RefreshCcw, Ruler } from 'lucide-react'
import { toast } from 'sonner'

import { CustomTableTopDialog } from '@/components/CustomTableTopDialog'
import { DesignSelector } from '@/components/DesignSelector'
import { QuantityStepper } from '@/components/QuantityStepper'
import { SafeImage } from '@/components/SafeImage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { getDefaultVariant } from '@/lib/catalogue'
import {
  formatProductDimensions,
  type DesignVariant,
  type Product,
} from '@/lib/products'
import { variantMinimum } from '@/lib/quantity'
import {
  TABLE_TOP_SHAPE_LABEL,
  compatibleBases,
  compatibleTops,
  composedCartLines,
  composedQuantityRule,
  isTableBase,
  topShapeOf,
} from '@/lib/table-composer'
import { useCartStore } from '@/stores/cart.store'

// « Composer ma table » : piètement + plateau en deux temps, quantités
// égales, minimum imposé par le coloris le plus exigeant. Entrée depuis une
// carte piètement (choisir le plateau) ou une carte plateau (choisir le
// piètement). Aucun prix affiché (règle catalogue v3 : « Prix détaillé au
// panier ») — les deux lignes arrivent dans le panier comme des lignes
// normales, modifiables séparément.

function findVariant(product: Product, variantId: string | null): DesignVariant {
  return (
    product.variants.find((variant) => variant.id === variantId) ??
    getDefaultVariant(product)
  )
}

function CandidateCard({
  product,
  onPick,
}: {
  readonly product: Product
  readonly onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="hover:border-foreground/40 flex min-w-0 flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card text-left transition-colors"
    >
      <SafeImage
        src={product.mainImageUrl}
        alt={product.name}
        className="aspect-square w-full bg-white"
        imgClassName="aspect-square w-full object-contain"
      />
      <div className="p-2">
        <div className="line-clamp-2 text-xs font-semibold leading-tight">
          {product.name}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatProductDimensions(product)}
          {product.category === 'table_top' &&
            ` · ${TABLE_TOP_SHAPE_LABEL[topShapeOf(product)]}`}
        </div>
      </div>
    </button>
  )
}

function SelectedPanel({
  step,
  title,
  product,
  variantId,
  onVariantChange,
  onChange,
  canChange,
  baseMinimum,
}: {
  readonly step: string
  readonly title: string
  readonly product: Product
  readonly variantId: string
  readonly onVariantChange: (id: string) => void
  readonly onChange: () => void
  readonly canChange: boolean
  /** Minimum de l'autre ligne : un coloris plus exigeant est signalé. */
  readonly baseMinimum: number
}) {
  const variant = findVariant(product, variantId)
  const colorMinimum = variantMinimum(variant)
  return (
    <section className="min-w-0 rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="label-eyebrow text-[color:var(--ember)]">
          {step} · {title}
        </div>
        {canChange && (
          <button
            type="button"
            onClick={onChange}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            <RefreshCcw className="h-3 w-3" /> Changer
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-3">
        <SafeImage
          src={variant.imageUrl || product.mainImageUrl}
          alt={`${product.name} — ${variant.name}`}
          className="h-20 w-20 shrink-0 rounded-sm bg-white"
          imgClassName="h-20 w-20 rounded-sm object-contain"
        />
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold leading-tight">
            {product.name}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {formatProductDimensions(product)}
            {product.category === 'table_top' &&
              ` · ${TABLE_TOP_SHAPE_LABEL[topShapeOf(product)]}`}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <DesignSelector
          variants={product.variants}
          selectedVariantId={variant.id}
          onChange={onVariantChange}
          showLabel={false}
          fallbackImageUrl={product.mainImageUrl}
        />
      </div>
      {colorMinimum > baseMinimum && (
        <p className="mt-2 rounded-sm bg-[color:var(--ember)]/10 px-2 py-1.5 text-[11px] leading-4 text-[color:var(--ember)]">
          Ce coloris se fabrique à partir de <strong>{colorMinimum}</strong>{' '}
          pièces : la quantité de l&apos;ensemble démarre à {colorMinimum}.
        </p>
      )}
    </section>
  )
}

function PickPanel({
  step,
  title,
  candidates,
  emptyLabel,
  onPick,
  onCustom,
}: {
  readonly step: string
  readonly title: string
  readonly candidates: ReadonlyArray<Product>
  readonly emptyLabel: string
  readonly onPick: (product: Product) => void
  /** Plateaux : carte « sur mesure » en fin de liste (découpe à la demande). */
  readonly onCustom?: () => void
}) {
  return (
    <section className="min-w-0 rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3">
      <div className="label-eyebrow text-[color:var(--ember)]">
        {step} · {title}
      </div>
      {candidates.length === 0 && !onCustom ? (
        <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-2 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {candidates.map((product) => (
            <CandidateCard
              key={product.id}
              product={product}
              onPick={() => onPick(product)}
            />
          ))}
          {onCustom && (
            <button
              type="button"
              onClick={onCustom}
              className="flex min-h-[9rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-[color:var(--ember)]/50 bg-[color:var(--ember)]/[0.06] p-3 text-center text-xs font-semibold text-[color:var(--ember)] transition-colors hover:bg-[color:var(--ember)]/10"
            >
              <Ruler className="h-5 w-5" />
              Autre dimension ?
              <span className="font-normal text-muted-foreground">
                Plateau découpé sur mesure, tarif sous 24 h
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export function TableComposerDialog({
  open,
  onOpenChange,
  products,
  initialProduct,
  initialVariantId,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly products: ReadonlyArray<Product>
  readonly initialProduct: Product
  readonly initialVariantId?: string
}) {
  const setLineQty = useCartStore((state) => state.setLineQty)
  const startsWithBase = isTableBase(initialProduct)

  const [baseId, setBaseId] = useState<string | null>(
    startsWithBase ? initialProduct.id : null,
  )
  const [topId, setTopId] = useState<string | null>(
    startsWithBase ? null : initialProduct.id,
  )
  const [baseVariantId, setBaseVariantId] = useState<string | null>(
    startsWithBase ? (initialVariantId ?? null) : null,
  )
  const [topVariantId, setTopVariantId] = useState<string | null>(
    startsWithBase ? null : (initialVariantId ?? null),
  )
  const [quantity, setQuantity] = useState(0)
  const [customOpen, setCustomOpen] = useState(false)

  // Réouverture sur un autre produit : repartir de celui-ci.
  useEffect(() => {
    if (!open) return
    const fromBase = isTableBase(initialProduct)
    setBaseId(fromBase ? initialProduct.id : null)
    setTopId(fromBase ? null : initialProduct.id)
    setBaseVariantId(fromBase ? (initialVariantId ?? null) : null)
    setTopVariantId(fromBase ? null : (initialVariantId ?? null))
    setQuantity(0)
  }, [open, initialProduct, initialVariantId])

  const base = useMemo(
    () => products.find((product) => product.id === baseId) ?? null,
    [products, baseId],
  )
  const top = useMemo(
    () => products.find((product) => product.id === topId) ?? null,
    [products, topId],
  )
  const topCandidates = useMemo(
    () => (base ? compatibleTops(base, products) : []),
    [base, products],
  )
  const baseCandidates = useMemo(
    () => (top ? compatibleBases(top, products) : []),
    [top, products],
  )

  const baseVariant = base ? findVariant(base, baseVariantId) : null
  const topVariant = top ? findVariant(top, topVariantId) : null
  const complete = Boolean(base && baseVariant && top && topVariant)
  const rule =
    base && baseVariant && top && topVariant
      ? composedQuantityRule({ base, baseVariant, top, topVariant })
      : null
  const effectiveQuantity = rule ? Math.max(quantity, rule.minimum) : 0

  const addToCart = () => {
    if (!base || !baseVariant || !top || !topVariant) return
    const lines = composedCartLines({
      base,
      baseVariant,
      top,
      topVariant,
      quantity: effectiveQuantity,
    })
    for (const line of lines) {
      setLineQty(line.productId, line.variantId, line.quantity, {
        silent: true,
      })
    }
    track(AnalyticsEvent.AddToCart, {
      product: base.id,
      sku: base.sku,
      quantity: effectiveQuantity,
      composed_with: top.sku,
    })
    toast.success('Table composée ajoutée à votre commande', {
      description: `${effectiveQuantity} × ${base.name} (${baseVariant.name}) + ${effectiveQuantity} × ${top.name} (${topVariant.name})`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-md border-[color:var(--sand-deep)] p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-1 px-5 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-lg tracking-tight">
            <Layers3 className="h-4 w-4 text-[color:var(--ember)]" />
            Composer ma table
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Un piètement, un plateau, une seule quantité : les deux lignes
            arrivent dans votre panier et restent modifiables séparément.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
          {base && baseVariant ? (
            <SelectedPanel
              step="1"
              title="Piètement"
              product={base}
              variantId={baseVariant.id}
              onVariantChange={setBaseVariantId}
              onChange={() => setBaseId(null)}
              canChange={!startsWithBase}
              baseMinimum={topVariant ? variantMinimum(topVariant) : 0}
            />
          ) : (
            <PickPanel
              step="1"
              title="Choisir le piètement"
              candidates={baseCandidates}
              emptyLabel="Aucun piètement compatible avec ce plateau pour le moment."
              onPick={(product) => {
                setBaseId(product.id)
                setBaseVariantId(null)
              }}
            />
          )}

          {top && topVariant ? (
            <SelectedPanel
              step="2"
              title="Plateau"
              product={top}
              variantId={topVariant.id}
              onVariantChange={setTopVariantId}
              onChange={() => setTopId(null)}
              canChange={startsWithBase}
              baseMinimum={baseVariant ? variantMinimum(baseVariant) : 0}
            />
          ) : (
            <PickPanel
              step="2"
              title="Choisir le plateau"
              candidates={topCandidates}
              emptyLabel="Aucun plateau compatible avec ce piètement pour le moment."
              onPick={(product) => {
                setTopId(product.id)
                setTopVariantId(null)
              }}
              onCustom={() => setCustomOpen(true)}
            />
          )}
        </div>

        {top && (
          <div className="px-5 pb-3 text-[11px] text-muted-foreground">
            Autre dimension ?{' '}
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="font-medium text-[color:var(--ember)] underline-offset-2 hover:underline"
            >
              Demander un plateau sur mesure
            </button>
          </div>
        )}

        <CustomTableTopDialog
          open={customOpen}
          onOpenChange={setCustomOpen}
          base={base}
          baseVariant={baseVariant}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-medium">
              {complete
                ? `${effectiveQuantity} table${effectiveQuantity > 1 ? 's' : ''} complète${effectiveQuantity > 1 ? 's' : ''}`
                : 'Sélectionnez les deux éléments'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {rule ? rule.label : '—'} · Prix détaillé au panier
            </div>
          </div>
          <div className="flex items-center gap-3">
            {rule && (
              <QuantityStepper
                value={effectiveQuantity}
                onChange={(next) => setQuantity(next)}
                rule={rule}
              />
            )}
            <Button
              type="button"
              disabled={!complete}
              onClick={addToCart}
              className="h-10 rounded-sm"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Ajouter au panier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
