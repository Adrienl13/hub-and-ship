import { TrendingDown } from 'lucide-react'

import type { CartItem } from '@/lib/order'
import {
  CUSTOMER_QUANTITY_DISCOUNT_TIERS,
  getCustomerDiscountStatus,
} from '@/lib/pricing/customer-discounts'

export function TieredPricingViz({ items }: { items: CartItem[] }) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const discountStatus = getCustomerDiscountStatus(totalUnits)

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Remise quantité
          </div>
          <div className="mt-1 text-muted-foreground">
            Remise additionnelle selon le nombre total d'unités réservées.
          </div>
        </div>
        <span className="bg-[color:var(--ember)]/10 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium text-[color:var(--ember)]">
          <TrendingDown className="h-3 w-3" />
          {discountStatus.discountPercent}%
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2">
          <div className="label-eyebrow text-muted-foreground">
            Quantité panier
          </div>
          <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {totalUnits} unités
          </div>
        </div>
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2">
          <div className="label-eyebrow text-muted-foreground">
            Remise active
          </div>
          <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {discountStatus.discountPercent}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {CUSTOMER_QUANTITY_DISCOUNT_TIERS.map((tier) => {
          const active = tier === discountStatus.activeTier
          const reached = totalUnits >= tier.minUnits
          return (
            <div
              key={`${tier.minUnits}-${tier.discountPercent}`}
              className={`rounded-sm border px-1.5 py-2 text-center transition-colors ${
                active
                  ? 'border-foreground bg-[color:var(--sand)] text-foreground'
                  : reached
                    ? 'border-[color:var(--forest)]/35 bg-[color:var(--forest)]/8 text-foreground/80'
                    : 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-muted-foreground'
              }`}
            >
              <div className="font-display text-sm font-semibold tabular-nums">
                {tier.discountPercent}%
              </div>
              <div className="mt-0.5 text-[9px] leading-tight">
                dès {tier.minUnits} unités
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2 text-[11px] text-muted-foreground">
        {discountStatus.nextTier ? (
          <>
            Encore{' '}
            <span className="font-medium text-foreground">
              {discountStatus.nextGapUnits} unités
            </span>{' '}
            pour atteindre {discountStatus.nextTier.discountPercent}% de remise.
          </>
        ) : (
          'Dernier palier atteint : remise quantité maximale appliquée.'
        )}
      </div>
    </div>
  )
}
