import { Check, Clock3, MapPin, Package, PackageCheck, Ruler, Weight } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StockLotGallery } from '@/components/StockLotGallery'
import { CATEGORY_LABEL, formatProductDimensions } from '@/lib/products'
import { STOCK_CONDITION_LABEL, type StockLine } from '@/lib/stock'
import { formatEUR } from '@/lib/order'

// Fiche détaillée d'un lot /stock-24h — même structure de titre/description
// que le dialog produit du catalogue (badges catégorie/état/SKU, titre
// display, description de la fiche produit) pour une expérience uniforme,
// + toutes les photos (lot ET fiche produit) et les faits du lot.

export function StockDetailDialog({
  line,
  open,
  onOpenChange,
  onRequest,
}: {
  readonly line: StockLine | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** « Demander ce lot » : sélectionne la ligne et amène au formulaire. */
  readonly onRequest: (line: StockLine) => void
}) {
  if (!line) return null
  const { product } = line

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[color:var(--sand-soft)] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-eyebrow text-foreground/70 rounded-sm bg-muted px-2 py-0.5">
              {CATEGORY_LABEL[product.category]}
            </span>
            <span className="label-eyebrow rounded-sm bg-[color:var(--forest)] px-2 py-0.5 text-white">
              {STOCK_CONDITION_LABEL[line.condition]}
            </span>
            <span className="label-eyebrow bg-[color:var(--ember)]/10 rounded-sm px-2 py-0.5 text-[color:var(--ember)]">
              {line.readyLabel}
            </span>
            <span className="label-eyebrow text-muted-foreground">
              {product.sku}
            </span>
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {product.name}
          </DialogTitle>
          {product.description && (
            <DialogDescription className="text-foreground/70 text-sm leading-relaxed">
              {product.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Photos : lot réel en priorité, puis fiche produit complète */}
          <div className="space-y-2">
            <StockLotGallery line={line} includeProductGallery />

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              {[
                {
                  Icon: Ruler,
                  k: 'Dimensions',
                  v: formatProductDimensions(product),
                },
                { Icon: Weight, k: 'Poids', v: `${product.weightKg} kg` },
                {
                  Icon: Package,
                  k: 'Volume',
                  v: `${product.cbmPerUnit.toFixed(3)} m³`,
                },
                {
                  Icon: PackageCheck,
                  k: 'Design',
                  v: line.variant.name,
                },
              ].map(({ Icon, k, v }) => (
                <div
                  key={k}
                  className="rounded-sm border border-[color:var(--sand-deep)] bg-card p-2.5"
                >
                  <div className="label-eyebrow flex items-center gap-1 text-muted-foreground">
                    <Icon className="h-3 w-3" /> {k}
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Faits du lot + prix + CTA */}
          <div className="space-y-4">
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="flex items-baseline gap-3">
                <div className="font-display text-3xl font-semibold tabular-nums">
                  {formatEUR(line.stockPriceHt)}
                </div>
                <span className="text-xs text-muted-foreground">
                  HT / unité
                </span>
              </div>
              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5" />
                  {line.availableUnits} unité
                  {line.availableUnits > 1 ? 's' : ''} disponible
                  {line.availableUnits > 1 ? 's' : ''} immédiatement
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Retrait : {line.location}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {line.readyLabel} — pas d&apos;attente container
                </div>
              </div>
            </div>

            {line.note && (
              <p className="rounded-sm bg-[color:var(--sand)] px-3 py-2 text-xs leading-5 text-muted-foreground">
                {line.note}
              </p>
            )}

            {product.features.length > 0 && (
              <div>
                <div className="label-eyebrow mb-1.5 text-muted-foreground">
                  Caractéristiques
                </div>
                <ul className="text-foreground/80 grid grid-cols-1 gap-1 text-xs">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--forest)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="button"
              className="h-11 w-full rounded-[9px] text-sm font-bold"
              onClick={() => onRequest(line)}
            >
              Demander ce lot
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
