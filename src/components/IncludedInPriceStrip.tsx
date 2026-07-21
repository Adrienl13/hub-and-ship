import { Check } from 'lucide-react'

import { getPublicPricingRules } from '@/lib/pricing/public-rules'

// Bande de réassurance du catalogue : ce que chaque prix affiché contient
// déjà, et la remise volume automatique — pour que l'acheteur comprenne
// immédiatement les règles du jeu. Les paliers viennent des règles publiques
// actives (les mêmes que le panier), jamais codés en dur.
export function IncludedInPriceStrip() {
  const rules = getPublicPricingRules()
  const items = [
    'Fret maritime & dédouanement',
    'Contrôle SGS avant départ',
    'Garantie 2 ans + SAV France',
    `Remise auto : −${Math.round(rules.tier2Discount * 100)} % ≥${rules.tier2Qty} pcs · −${Math.round(rules.tier3Discount * 100)} % ≥${rules.tier3Qty} pcs`,
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
