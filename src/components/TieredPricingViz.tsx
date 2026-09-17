import { TrendingDown } from 'lucide-react'

import type { CartItem } from '@/lib/order'
import {
  getCustomerDiscountStatus,
  type CustomerDiscountTier,
} from '@/lib/pricing/customer-discounts'
import {
  DISCOUNT_FAMILIES,
  DISCOUNT_FAMILY_LABEL,
  DISCOUNT_FAMILY_UNIT,
  countUnitsByFamily,
  type DiscountFamily,
} from '@/lib/pricing/discount-families'
import {
  getActiveCustomerDiscountTiers,
  getFamilyDiscountTiers,
  getVolumeFamilyTiers,
} from '@/lib/pricing/public-rules'

/**
 * « Remise quantité » — ce qui pousse l'acheteur au palier suivant.
 *
 * Deux affichages, selon le régime actif (cf. calculateOrder) :
 *  — grille unique : un seul bloc sur le total des pièces, comme avant ;
 *  — grille par famille : un bloc PAR FAMILLE présente dans le panier, avec
 *    ses propres pièces et ses propres paliers. Sans ça, un panier de salons
 *    verrait « encore 94 unités pour −6 % » alors que sa remise se déclenche
 *    à 5 salons — le message le plus décourageant possible.
 */
export function TieredPricingViz({ items }: { items: CartItem[] }) {
  const families = getVolumeFamilyTiers()

  if (!families) {
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
    return (
      <Card
        intro="Remise additionnelle selon le nombre total d'unités réservées."
        blocks={[
          {
            key: 'global',
            title: 'Quantité panier',
            units: totalUnits,
            unitLabel: 'unité',
            tiers: getActiveCustomerDiscountTiers(),
          },
        ]}
      />
    )
  }

  const unitsByFamily = countUnitsByFamily(
    items.map((item) => ({
      category: item.product.category,
      quantity: item.quantity,
    })),
  )
  const present = DISCOUNT_FAMILIES.filter(
    (family) => unitsByFamily[family] > 0,
  )

  return (
    <Card
      intro="Chaque famille a ses propres paliers : les assises, les tables et les salons ne se commandent pas aux mêmes quantités."
      blocks={(present.length > 0 ? present : (['assises'] as DiscountFamily[])).map(
        (family) => ({
          key: family,
          title: DISCOUNT_FAMILY_LABEL[family],
          units: unitsByFamily[family],
          unitLabel: DISCOUNT_FAMILY_UNIT[family],
          tiers: getFamilyDiscountTiers(family),
        }),
      )}
    />
  )
}

interface Block {
  readonly key: string
  readonly title: string
  readonly units: number
  readonly unitLabel: string
  readonly tiers: ReadonlyArray<CustomerDiscountTier>
}

function Card({
  intro,
  blocks,
}: {
  readonly intro: string
  readonly blocks: ReadonlyArray<Block>
}) {
  // Le badge d'en-tête annonce la meilleure remise déjà acquise : c'est la
  // bonne nouvelle, elle doit se lire sans dérouler le détail.
  const best = blocks.reduce(
    (max, block) =>
      Math.max(
        max,
        getCustomerDiscountStatus(block.units, block.tiers).discountPercent,
      ),
    0,
  )

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Remise quantité
          </div>
          <div className="mt-1 text-muted-foreground">{intro}</div>
        </div>
        <span className="bg-[color:var(--ember)]/10 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium text-[color:var(--ember)]">
          <TrendingDown className="h-3 w-3" />
          {best}%
        </span>
      </div>

      <div className="space-y-3">
        {blocks.map((block) => (
          <FamilyBlock key={block.key} block={block} />
        ))}
      </div>
    </div>
  )
}

function FamilyBlock({ block }: { readonly block: Block }) {
  const status = getCustomerDiscountStatus(block.units, block.tiers)
  const plural = block.units > 1 ? 's' : ''

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2">
          <div className="label-eyebrow text-muted-foreground">
            {block.title}
          </div>
          <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {block.units} {block.unitLabel}
            {plural}
          </div>
        </div>
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2">
          <div className="label-eyebrow text-muted-foreground">
            Remise active
          </div>
          <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {status.discountPercent}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {block.tiers.map((tier) => {
          const active = tier === status.activeTier
          const reached = block.units >= tier.minUnits
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
                dès {tier.minUnits} {block.unitLabel}
                {tier.minUnits > 1 ? 's' : ''}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2 text-[11px] text-muted-foreground">
        {status.nextTier ? (
          <>
            Encore{' '}
            <span className="font-medium text-foreground">
              {status.nextGapUnits} {block.unitLabel}
              {status.nextGapUnits > 1 ? 's' : ''}
            </span>{' '}
            pour atteindre {status.nextTier.discountPercent}% de remise.
          </>
        ) : (
          'Dernier palier atteint : remise quantité maximale appliquée.'
        )}
      </div>
    </div>
  )
}
