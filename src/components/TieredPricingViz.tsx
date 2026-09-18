import { TrendingDown } from 'lucide-react'

import type { CartItem } from '@/lib/order'
import {
  buildVolumeScales,
  type VolumeScale,
} from '@/lib/pricing/volume-progress'

/**
 * « Remise quantité » — ce qui pousse l'acheteur au palier suivant, sur
 * `/panier` et dans la colonne de commande.
 *
 * Les paliers diffèrent d'une famille à l'autre : une ligne par famille
 * présente au panier, chacune à sa propre échelle. Un acheteur de salons qui
 * lirait « encore 94 unités » alors que sa remise se déclenche à 10 pièces
 * ne comprendrait pas qu'il en est à deux salons du but.
 *
 * Le calcul vient de `buildVolumeScales()`, LE MÊME que celui du tiroir du
 * catalogue. C'est délibéré : ces deux surfaces décrivaient la même chose
 * avec deux implémentations, et deux implémentations finissent toujours par
 * diverger — un libellé ici, un arrondi là, et le panier ne dit plus ce que
 * disait le catalogue.
 */
export function TieredPricingViz({ items }: { items: CartItem[] }) {
  const scales = buildVolumeScales(
    items.map((item) => ({
      category: item.product.category,
      quantity: item.quantity,
    })),
  )

  if (scales.length === 0) return null

  // La meilleure remise déjà acquise : c'est la bonne nouvelle, elle doit se
  // lire sans dérouler le détail.
  const best = scales.reduce(
    (max, scale) => Math.max(max, scale.discountPercent),
    0,
  )

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Remise quantité
          </div>
          <div className="mt-1 text-muted-foreground">
            Chaque famille a ses propres paliers : les assises, les tables et
            les salons ne se commandent pas aux mêmes quantités.
          </div>
        </div>
        <span className="bg-[color:var(--ember)]/10 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium text-[color:var(--ember)]">
          <TrendingDown className="h-3 w-3" />
          {best}%
        </span>
      </div>

      <div className="space-y-3">
        {scales.map((scale) => (
          <FamilyBlock key={scale.family} scale={scale} />
        ))}
      </div>
    </div>
  )
}

function FamilyBlock({ scale }: { readonly scale: VolumeScale }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-medium text-foreground">{scale.familyLabel}</span>
        <span className="tabular-nums text-muted-foreground">
          {scale.unitsLabel}
        </span>
      </div>

      {/* Une seule échelle : de zéro au dernier palier de la famille. La piste
          n'atteint un repère que lorsque le palier l'est vraiment. */}
      <div className="relative h-1.5 bg-[color:var(--sand-deep)]">
        <div
          className="absolute inset-y-0 left-0 bg-[color:var(--ember)] transition-[width] duration-500"
          style={{ width: scale.fill }}
        />
        {scale.marks.map((mark) => (
          <span
            key={mark.label}
            className="absolute -top-[3px] h-3 w-px"
            style={{ left: mark.left, background: mark.tone }}
          />
        ))}
      </div>

      <div className="relative mt-1 h-4">
        {scale.marks.map((mark) => (
          <span
            key={mark.label}
            className="mono absolute whitespace-nowrap text-[9.5px] tracking-[0.06em]"
            style={{
              left: mark.left,
              transform: mark.shift,
              color: mark.tone,
            }}
          >
            {mark.label}
          </span>
        ))}
      </div>

      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {scale.state}
      </div>
    </div>
  )
}
