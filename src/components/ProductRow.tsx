import { Minus, Plus, Check, Info, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CATEGORY_LABEL,
  type ColorVariant,
  type Product,
} from "@/lib/products";
import { getMoqStatus, formatEUR } from "@/lib/order";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/motion-helpers";

function ColorDot({
  variant,
  selected,
  onClick,
}: {
  variant: ColorVariant;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={variant.name}
      aria-label={variant.name}
      aria-pressed={selected}
      className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/15 transition-all hover:scale-110 ${
        selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
      }`}
      style={{ background: variant.hex }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className="h-3 w-3 text-white drop-shadow" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

const TONE_CLASSES: Record<string, string> = {
  success: "bg-[color:var(--forest)]/12 text-[color:var(--forest)] border-[color:var(--forest)]/25",
  amber: "bg-[color:var(--ember)]/10 text-[color:var(--ember)] border-[color:var(--ember)]/25",
  ochre: "bg-[color:var(--ochre)]/10 text-[color:var(--ochre)] border-[color:var(--ochre)]/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

const TONE_BAR: Record<string, string> = {
  success: "bg-[color:var(--forest)]",
  amber: "bg-[color:var(--ember)]",
  ochre: "bg-[color:var(--ochre)]",
  neutral: "bg-foreground/40",
};

export function ProductRow({
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
  const savingsPct = Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100);
  const totalCommitted = (variant?.unitsCommitted ?? 0) + qty;
  const moqStatus = getMoqStatus(totalCommitted, moq);

  const inc = () => onQtyChange(qty + 1);
  const dec = () => onQtyChange(Math.max(0, qty - 1));

  return (
    <article className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-colors hover:border-foreground/30">
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label-eyebrow text-muted-foreground">Couleur :</span>
            {product.variants.map((v) => (
              <ColorDot
                key={v.id}
                variant={v}
                selected={v.id === variantId}
                onClick={() => onVariantChange(v.id)}
              />
            ))}
            {variant && (
              <span className="text-xs text-foreground/80">
                Sélectionné : <span className="font-medium">{variant.name}</span>
              </span>
            )}
          </div>

          {/* MOQ progress */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="label-eyebrow text-muted-foreground">
                MOQ {variant?.name}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLASSES[moqStatus.tone]}`}
              >
                {moqStatus.status === "reached" ? (
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {moqStatus.label}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
              <div
                className={`h-full transition-all duration-500 ${TONE_BAR[moqStatus.tone]}`}
                style={{ width: `${Math.min(100, moqStatus.percent)}%` }}
              />
            </div>
          </div>

          {/* Quantité + détails */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-sm hover:bg-background"
                onClick={dec}
                disabled={qty === 0}
                aria-label="Diminuer"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <input
                type="number"
                value={qty}
                onChange={(e) => onQtyChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums focus:outline-none"
                aria-label="Quantité"
                min={0}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-sm hover:bg-background"
                onClick={inc}
                aria-label="Augmenter"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
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
