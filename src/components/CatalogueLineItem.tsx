import { Info } from "lucide-react";
import { memo, useMemo } from "react";

import { MoqProgressBar } from "@/components/MoqProgressBar";
import { QuantityStepper } from "@/components/QuantityStepper";
import { VariantSelector } from "@/components/VariantSelector";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, type Product } from "@/lib/products";
import { formatEUR, getMoqStatus } from "@/lib/order";
import { getQuantityRule } from "@/lib/quantity";

function CatalogueLineItemComponent({
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
  onVariantChange: (variantId: string) => void;
  onOpenDetails: () => void;
}) {
  const variant = useMemo(
    () => product.variants.find((item) => item.id === variantId) ?? product.variants[0],
    [product.variants, variantId],
  );
  const quantityRule = getQuantityRule(product);
  const moqStatus = getMoqStatus((variant?.unitsCommitted ?? 0) + qty, product.moqUnits);

  return (
    <article
      data-catalogue-line-item
      className="grid gap-3 border-b border-[color:var(--sand-deep)] bg-card px-3 py-3 text-sm transition-colors hover:bg-[color:var(--sand-soft)] md:grid-cols-[52px_minmax(160px,1.3fr)_112px_118px_70px_122px_56px] md:items-center md:gap-2"
    >
      <button
        type="button"
        onClick={onOpenDetails}
        className="relative h-20 w-full overflow-hidden rounded-sm bg-[color:var(--sand)] ring-1 ring-foreground/10 md:h-[52px] md:w-[52px]"
        aria-label={`Voir détails ${product.name}`}
      >
        <img
          src={product.mainImageUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span
          className="absolute inset-x-0 bottom-0 h-1.5"
          style={{ backgroundColor: variant?.hex }}
        />
      </button>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2 md:block">
          <button
            type="button"
            onClick={onOpenDetails}
            className="group/name flex min-w-0 items-start gap-1.5 text-left"
          >
            <span className="min-w-0 font-display text-base font-semibold leading-tight tracking-tight md:truncate">
              {product.name}
            </span>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70 md:opacity-0 md:transition-opacity md:group-hover/name:opacity-100" />
          </button>
          <div className="shrink-0 text-right md:hidden">
            <div className="font-display text-lg font-semibold tabular-nums">
              {formatEUR(product.basePriceHt)}
            </div>
            <div className="text-[10px] text-[color:var(--ember)]">
              -{Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100)}%
            </div>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground md:gap-x-1.5">
          <span>{product.sku}</span>
          <span>{CATEGORY_LABEL[product.category]}</span>
          <span>
            {product.dimensions.l}x{product.dimensions.w}x{product.dimensions.h} cm
          </span>
          <span>{product.cbmPerUnit.toFixed(2)} m3/u</span>
        </div>
      </div>

      <VariantSelector
        variants={product.variants}
        selectedVariantId={variantId}
        onChange={onVariantChange}
        showLabel={false}
      />

      <MoqProgressBar label={`MOQ ${product.moqUnits}`} status={moqStatus} />

      <div className="hidden text-right md:block">
        <div className="font-display text-sm font-semibold tabular-nums">
          {formatEUR(product.basePriceHt)}
        </div>
        <div className="text-[10px] text-muted-foreground">
          <span className="line-through">{formatEUR(product.retailPriceRef)}</span>
          <span className="ml-1 text-[color:var(--ember)]">
            -{Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100)}%
          </span>
        </div>
      </div>

      <QuantityStepper
        value={qty}
        onChange={onQtyChange}
        rule={quantityRule}
        showRule={product.category === "chair"}
      />

      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-sm border-[color:var(--sand-deep)] px-2 text-xs"
        onClick={onOpenDetails}
      >
        Voir
      </Button>
    </article>
  );
}

export const CatalogueLineItem = memo(CatalogueLineItemComponent);
