import { memo, useMemo } from "react";
import { Info } from "lucide-react";

import { MoqProgressBar } from "@/components/MoqProgressBar";
import { QuantityStepper } from "@/components/QuantityStepper";
import { VariantSelector } from "@/components/VariantSelector";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, type Product } from "@/lib/products";
import { formatEUR, getMoqStatus } from "@/lib/order";
import { getQuantityRule } from "@/lib/quantity";

function ProductCardComponent({
  product,
  variantId,
  qty,
  onQtyChange,
  onVariantChange,
  onOpenDetails,
}: {
  product: Product;
  variantId: string;
  qty: number;
  onQtyChange: (value: number) => void;
  onVariantChange: (id: string) => void;
  onOpenDetails?: () => void;
}) {
  const variant = useMemo(
    () => product.variants.find((item) => item.id === variantId) ?? product.variants[0],
    [product.variants, variantId],
  );
  const savingsPct = Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100);
  const totalCommitted = (variant?.unitsCommitted ?? 0) + qty;
  const moqStatus = getMoqStatus(totalCommitted, product.moqUnits);
  const quantityRule = getQuantityRule(product);

  return (
    <article
      data-catalog-item-mode="mobile-card"
      className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
    >
      <button
        type="button"
        onClick={onOpenDetails}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-[color:var(--sand)] text-left"
        aria-label={`Voir détails ${product.name}`}
      >
        <img
          src={product.mainImageUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span
          className="absolute inset-x-0 bottom-0 h-2"
          style={{ backgroundColor: variant?.hex }}
        />
        <span className="absolute left-3 top-3 rounded-sm bg-[color:var(--sand-soft)]/90 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur">
          {CATEGORY_LABEL[product.category]}
        </span>
      </button>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpenDetails}
              className="flex min-h-11 items-start gap-1.5 text-left"
            >
              <span className="font-display text-lg font-semibold leading-tight tracking-tight">
                {product.name}
              </span>
              <Info className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {product.dimensions.l}×{product.dimensions.w}×{product.dimensions.h} cm ·{" "}
              {product.cbmPerUnit.toFixed(2)} m³/u · MOQ {product.moqUnits}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-display text-xl font-semibold tabular-nums">
              {formatEUR(product.basePriceHt)}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              <span className="line-through">{formatEUR(product.retailPriceRef)}</span>
              <span className="ml-1 font-medium text-[color:var(--ember)]">
                -{savingsPct}%
              </span>
            </div>
          </div>
        </div>

        <VariantSelector
          variants={product.variants}
          selectedVariantId={variantId}
          onChange={onVariantChange}
          size="lg"
        />

        <MoqProgressBar label={`MOQ ${variant?.name}`} status={moqStatus} />

        <div className="flex items-center justify-between gap-3 pt-1">
          <QuantityStepper
            value={qty}
            onChange={onQtyChange}
            size="lg"
            rule={quantityRule}
            showRule={product.category === "chair"}
          />
          <Button
            variant="outline"
            className="h-11 rounded-sm border-[color:var(--sand-deep)] px-4"
            onClick={onOpenDetails}
          >
            Détails
          </Button>
        </div>
      </div>
    </article>
  );
}

export const ProductCard = memo(ProductCardComponent);
