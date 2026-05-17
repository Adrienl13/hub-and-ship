import { memo, useMemo } from "react";
import { Info } from "lucide-react";
import { CATEGORY_LABEL, type Product } from "@/lib/products";
import { getMoqStatus, formatEUR } from "@/lib/order";
import { getQuantityRule } from "@/lib/quantity";
import { Button } from "@/components/ui/button";
import { MoqProgressBar } from "@/components/MoqProgressBar";
import { QuantityStepper } from "@/components/QuantityStepper";
import { VariantSelector } from "@/components/VariantSelector";

function ProductRowComponent({
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
  onQtyChange: (n: number) => void;
  onVariantChange: (id: string) => void;
  onOpenDetails?: () => void;
}) {
  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0],
    [product, variantId],
  );
  const moq = product.moqUnits;
  const quantityRule = getQuantityRule(product);
  const savingsPct = Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100);
  const totalCommitted = (variant?.unitsCommitted ?? 0) + qty;
  const moqStatus = getMoqStatus(totalCommitted, moq);

  return (
    <article
      data-catalog-item-mode="desktop-row"
      className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <div className="flex gap-4">
        {/* Visual */}
        <button
          type="button"
          onClick={onOpenDetails}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md ring-1 ring-foreground/10 transition-transform hover:scale-[1.02] sm:h-28 sm:w-28"
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
        </button>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onOpenDetails}
                className="group/name inline-flex items-baseline gap-1.5 truncate text-left"
              >
                <span className="truncate font-display text-base font-semibold tracking-tight">
                  {product.name}
                </span>
                <Info className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
              </button>
              <div className="label-eyebrow mt-0.5 text-muted-foreground">
                {CATEGORY_LABEL[product.category]} · {product.dimensions.l}×{product.dimensions.w}×{product.dimensions.h} cm · {product.cbmPerUnit.toFixed(2)} m³/u · MOQ {moq}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-semibold tabular-nums">
                {formatEUR(product.basePriceHt)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                <span className="line-through">{formatEUR(product.retailPriceRef)}</span>
                <span className="ml-1.5 font-medium text-[color:var(--ember)]">−{savingsPct}%</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                + éco-part {product.ecoContribution.toFixed(2)}€
              </div>
            </div>
          </div>

          {/* Variantes */}
          <div className="mt-3">
            <VariantSelector
              variants={product.variants}
              selectedVariantId={variantId}
              onChange={onVariantChange}
            />
          </div>

          {/* MOQ progress */}
          <div className="mt-3">
            <MoqProgressBar label={`MOQ ${variant?.name}`} status={moqStatus} />
          </div>

          {/* Quantité + détails */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <QuantityStepper
              value={qty}
              onChange={onQtyChange}
              rule={quantityRule}
              showRule={product.category === "chair"}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-sm border-[color:var(--sand-deep)] text-xs"
              onClick={onOpenDetails}
            >
              Détails
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export const ProductRow = memo(ProductRowComponent);
