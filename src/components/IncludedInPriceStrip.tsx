import { Check } from 'lucide-react'

import {
  DISCOUNT_FAMILY_LABEL,
  PUBLIC_DISCOUNT_FAMILIES,
} from '@/lib/pricing/discount-families'
import {
  getPublicPricingRules,
  getVolumeFamilyTiers,
} from '@/lib/pricing/public-rules'

// Bande de réassurance du catalogue : ce que chaque prix affiché contient
// déjà, et la remise volume automatique — pour que l'acheteur comprenne
// immédiatement les règles du jeu. Les paliers viennent des règles publiques
// actives (les mêmes que le panier), jamais codés en dur.
export function IncludedInPriceStrip() {
  const rules = getPublicPricingRules()
  const families = getVolumeFamilyTiers()
  // Avec des paliers par famille, un seuil unique serait faux pour deux
  // familles sur trois. On annonce donc le PREMIER seuil de chacune — la
  // bande est étroite, le détail vit sur /prix et sur la fiche produit.
  const discountLabel = families
    ? `Remise auto par famille : ${PUBLIC_DISCOUNT_FAMILIES.map(
        (family) =>
          `${DISCOUNT_FAMILY_LABEL[family].toLowerCase()} ≥${families[family][0]!.minUnits}`,
      ).join(' · ')}`
    : `Remise auto : −${Math.round(rules.tier2Discount * 100)} % ≥${rules.tier2Qty} pcs · −${Math.round(rules.tier3Discount * 100)} % ≥${rules.tier3Qty} pcs`
  const items = [
    'Fret maritime & dédouanement',
    'Contrôle SGS avant départ',
    'Garantie 1 an + SAV France',
    discountLabel,
  ]

  return (
    <div className="rounded-2xl border border-[color:var(--sand-deep)] bg-white px-4 py-3.5 sm:px-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-6">
        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ember)]">
          Inclus dans chaque prix
        </span>
        <ul className="m-0 flex list-none flex-col flex-wrap gap-x-6 gap-y-1.5 p-0 sm:flex-row sm:items-center">
          {items.map((label) => (
            <li
              key={label}
              className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"
            >
              <Check
                className="h-4 w-4 shrink-0 text-[color:var(--forest)]"
                strokeWidth={3}
              />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
