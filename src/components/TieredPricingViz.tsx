import { TrendingDown } from "lucide-react";

import {
  DEFAULT_PRICING_TIERS,
  calculateOrderPricing,
  type CartLineForPricing,
} from "@/lib/pricing/tiers";
import type { CartItem } from "@/lib/order";

function toPricingLine(item: CartItem): CartLineForPricing {
  return {
    productId: item.product.id,
    variantId: item.variant.id,
    variantCombinationId: null,
    quantity: item.quantity,
    cbmPerUnit: item.product.cbmPerUnit,
    costLanded: 0,
    ecoContribution: item.product.ecoContribution,
  };
}

function formatCbm(value: number) {
  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })} m3`;
}

export function TieredPricingViz({ items }: { items: CartItem[] }) {
  const pricing = calculateOrderPricing(items.map(toPricingLine));
  const totalCbm = pricing.totalCbm;
  const currentTier =
    DEFAULT_PRICING_TIERS.find(
      (tier) => totalCbm >= tier.minCbm && totalCbm < (tier.maxCbm ?? Infinity),
    ) ?? DEFAULT_PRICING_TIERS[0]!;
  const nextTier = DEFAULT_PRICING_TIERS.find((tier) => tier.minCbm > totalCbm);
  const nextGap = nextTier ? Math.max(0, nextTier.minCbm - totalCbm) : 0;

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">Prix par volume</div>
          <div className="mt-1 text-muted-foreground">
            Marges dégressives selon le CBM total réservé.
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-sm bg-[color:var(--ember)]/10 px-2 py-1 text-[10px] font-medium text-[color:var(--ember)]">
          <TrendingDown className="h-3 w-3" />
          {pricing.effectiveMarginPercent.toFixed(1)}%
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2">
          <div className="label-eyebrow text-muted-foreground">Volume panier</div>
          <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {formatCbm(totalCbm)}
          </div>
        </div>
        <div className="rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2">
          <div className="label-eyebrow text-muted-foreground">Palier actif</div>
          <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
            {currentTier.marginPercent}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {DEFAULT_PRICING_TIERS.map((tier) => {
          const tierEnd = tier.maxCbm ?? null;
          const active = tier === currentTier;
          const reached = totalCbm >= tier.minCbm;
          return (
            <div
              key={`${tier.minCbm}-${tier.marginPercent}`}
              className={`rounded-sm border px-1.5 py-2 text-center transition-colors ${
                active
                  ? "border-foreground bg-[color:var(--sand)] text-foreground"
                  : reached
                    ? "border-[color:var(--forest)]/35 bg-[color:var(--forest)]/8 text-foreground/80"
                    : "border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-muted-foreground"
              }`}
            >
              <div className="font-display text-sm font-semibold tabular-nums">
                {tier.marginPercent}%
              </div>
              <div className="mt-0.5 text-[9px] leading-tight">
                {tierEnd ? `${tier.minCbm}-${tierEnd}` : `${tier.minCbm}+`} m3
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2 text-[11px] text-muted-foreground">
        {nextTier ? (
          <>
            Encore <span className="font-medium text-foreground">{formatCbm(nextGap)}</span>{" "}
            pour atteindre le palier {nextTier.marginPercent}%.
          </>
        ) : (
          "Dernier palier atteint : le container bénéficie du meilleur niveau de marge."
        )}
      </div>
    </div>
  );
}
