import { memo, useMemo } from 'react'
import { Check, Info, Layers3 } from 'lucide-react'

import { MoqProgressBar } from '@/components/MoqProgressBar'
import { SafeImage } from '@/components/SafeImage'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DesignSelector } from '@/components/DesignSelector'
import {
  CATEGORY_LABEL,
  formatProductDimensions,
  type Product,
} from '@/lib/products'
import { getMoqStatus } from '@/lib/order'
import { getQuantityRule } from '@/lib/quantity'
import {
  TABLE_TOP_SHAPE_LABEL,
  isComposable,
  topShapeOf,
} from '@/lib/table-composer'

function showsDimensions(product: Product): boolean {
  return (
    product.category === 'table_top' ||
    product.category === 'table_base' ||
    product.category === 'table'
  )
}

// Fiche catalogue v3 (handoff design 08/2026, validé) : AUCUN prix sur la
// fiche — seulement le badge « −X % vs prix public » et « Prix détaillé au
// panier ». Les montants (PU, sous-total, remise, acompte) ne vivent que
// dans le panneau panier (#panier) et le devis. Pas non plus de ligne de
// confirmation sur la fiche : le feedback est dans le panier et la barre
// de commande fixe.
function ProductCardComponent({
  product,
  variantId,
  qty,
  onQtyChange,
  onVariantChange,
  onOpenDetails,
  onCompose,
}: {
  product: Product
  variantId: string
  qty: number
  onQtyChange: (value: number) => void
  onVariantChange: (id: string) => void
  onOpenDetails?: () => void
  /** Piètements et plateaux : ouvre « Composer ma table ». */
  onCompose?: () => void
}) {
  const variant = useMemo(
    () =>
      product.variants.find((item) => item.id === variantId) ??
      product.variants[0],
    [product.variants, variantId],
  )
  // Un produit sans prix public de référence (fiche en cours de complétion)
  // affichait « −-Infinity % » : le badge n'apparaît que si la comparaison
  // a un sens (bug mobile signalé 08/2026).
  const savingsPct =
    product.retailPriceRef > product.basePriceHt && product.basePriceHt > 0
      ? Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100)
      : null
  const totalCommitted = (variant?.unitsCommitted ?? 0) + qty
  const moqStatus = getMoqStatus(totalCommitted, product.moqUnits)
  const quantityRule = getQuantityRule(product, variant)

  return (
    // PAS de content-visibility/contain-intrinsic-size ici : la valeur
    // « 520px » fixait aussi une LARGEUR intrinsèque de 520 px que Safari
    // iOS appliquait aux cartes hors écran — la grille mobile débordait
    // (bug signalé 08/2026, invisible sur Chrome). La pagination à 36
    // cartes rend l'optimisation inutile ; min-w-0/max-w-full verrouillent
    // la carte dans sa colonne quel que soit le moteur.
    <article
      data-catalog-item-mode="portrait-card"
      className="shadow-paper group flex min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
    >
      {/* Visuel produit plein, non recouvert */}
      <div className="relative">
        <button
          type="button"
          onClick={onOpenDetails}
          className="block aspect-square w-full overflow-hidden bg-white text-left"
          aria-label={`Voir détails ${product.name}`}
        >
          {/* L'image suit le design sélectionné : choisir un coloris doit se
              VOIR immédiatement (retour client 08/2026). object-contain sur
              fond blanc : une photo non carrée s'affiche ENTIÈRE au lieu
              d'être recadrée (bug « photo coupée » signalé 08/2026). */}
          <SafeImage
            src={variant?.imageUrl || product.mainImageUrl}
            alt={`${product.name}${variant ? ` — ${variant.name}` : ''}`}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </button>

        <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-sm backdrop-blur">
          {CATEGORY_LABEL[product.category]}
        </span>

        {/* Série confirmée = signal fort : la production est acquise. */}
        {moqStatus.status === 'reached' && (
          <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm bg-[color:var(--forest)] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            Série confirmée
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Infos & contrôles sous le visuel — zones à hauteur FIXE pour que
          nom, sélecteur et barre de série s'alignent d'une carte à l'autre. */}
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

        {/* Plateaux, piètements et tables : la dimension est le critère de
            choix n° 1, elle se lit sans ouvrir la fiche. */}
        {showsDimensions(product) && (
          <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {formatProductDimensions(product)}
            {product.category === 'table_top' &&
              ` · ${TABLE_TOP_SHAPE_LABEL[topShapeOf(product)]}`}
          </div>
        )}

        {/* Prix volontairement absent : badge économie + renvoi panier. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[color:var(--sand-deep)] pt-1.5">
          {savingsPct !== null && (
            <span className="rounded-sm bg-[color:var(--forest-bg)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[color:var(--forest)]">
              −{savingsPct} % vs prix public
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            Prix détaillé au panier
          </span>
        </div>

        <div className="mt-2">
          <DesignSelector
            variants={product.variants}
            selectedVariantId={variantId}
            onChange={onVariantChange}
            showLabel={false}
            fallbackImageUrl={product.mainImageUrl}
            customizeProduct={product}
          />
        </div>

        <div className="mt-2">
          <MoqProgressBar
            label={`Série ${Math.min(totalCommitted, product.moqUnits)}/${product.moqUnits}`}
            status={
              // Libellé compact du prototype : « Série complète » (le compte
              // détaillé est déjà dans le label de gauche).
              moqStatus.status === 'reached'
                ? { ...moqStatus, label: 'Série complète' }
                : moqStatus
            }
          />
        </div>

        {/* Piètement ou plateau : la table se compose en deux temps, avec une
            seule quantité pour les deux lignes. Le stepper reste disponible
            pour commander l'élément seul. */}
        {onCompose && isComposable(product) && (
          <button
            type="button"
            onClick={onCompose}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-sm border border-[color:var(--ember)]/40 bg-[color:var(--ember)]/10 text-xs font-semibold text-[color:var(--ember)] transition-colors hover:bg-[color:var(--ember)]/15"
          >
            <Layers3 className="h-3.5 w-3.5" />
            {product.category === 'table_base'
              ? 'Composer avec un plateau'
              : 'Composer avec un piètement'}
          </button>
        )}

        <div className="mt-auto pt-2.5">
          <QuantityStepper
            value={qty}
            onChange={onQtyChange}
            rule={quantityRule}
            showRule
          />
        </div>
      </div>
    </article>
  )
}

export const ProductCard = memo(ProductCardComponent)
