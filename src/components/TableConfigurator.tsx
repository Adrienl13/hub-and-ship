import { useEffect, useMemo, useState } from "react";
import { Check, Layers3 } from "lucide-react";

import { VariantSelector } from "@/components/VariantSelector";
import type { Product } from "@/lib/products";
import { formatEUR } from "@/lib/order";

type TableShapeId = "round-80" | "square-70" | "rect-160" | "base-only";
type FootFinishId = "black-matte" | "champagne";

const TABLE_SHAPES: Array<{
  id: TableShapeId;
  title: string;
  meta: string;
  priceModifier: number;
}> = [
  {
    id: "round-80",
    title: "Rond 80",
    meta: "2 à 4 couverts",
    priceModifier: 0,
  },
  {
    id: "square-70",
    title: "Carré 70",
    meta: "terrasses étroites",
    priceModifier: -0.08,
  },
  {
    id: "rect-160",
    title: "Rect. 160x80",
    meta: "6 couverts",
    priceModifier: 0.18,
  },
  {
    id: "base-only",
    title: "Pied seul",
    meta: "-30% hors plateau",
    priceModifier: -0.3,
  },
];

const FOOT_FINISHES: Array<{
  id: FootFinishId;
  title: string;
  hex: string;
}> = [
  { id: "black-matte", title: "Noir mat", hex: "#1f1f1f" },
  { id: "champagne", title: "Alu champagne", hex: "#b8aa8f" },
];

function defaultShapeForProduct(product: Product): TableShapeId {
  if (product.dimensions.l >= 140) return "rect-160";
  return "round-80";
}

export function TableConfigurator({
  product,
  variantId,
  onVariantChange,
}: {
  product: Product;
  variantId: string;
  onVariantChange: (variantId: string) => void;
}) {
  const [shapeId, setShapeId] = useState<TableShapeId>(() => defaultShapeForProduct(product));
  const [footFinishId, setFootFinishId] = useState<FootFinishId>("black-matte");

  useEffect(() => {
    setShapeId(defaultShapeForProduct(product));
    setFootFinishId("black-matte");
  }, [product]);

  const selectedShape =
    TABLE_SHAPES.find((shape) => shape.id === shapeId) ?? TABLE_SHAPES[0]!;
  const selectedFoot =
    FOOT_FINISHES.find((finish) => finish.id === footFinishId) ?? FOOT_FINISHES[0]!;
  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const adjustedPrice = Math.max(
    0,
    product.basePriceHt * (1 + selectedShape.priceModifier),
  );
  const configurationCode = useMemo(() => {
    return [
      product.sku,
      selectedShape.id.toUpperCase(),
      selectedVariant?.name.replace(/\s+/g, "-").toUpperCase() ?? "PLATEAU",
      selectedFoot.id.toUpperCase(),
    ].join(" / ");
  }, [product.sku, selectedFoot.id, selectedShape.id, selectedVariant?.name]);

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="mb-4 flex items-start gap-2">
        <Layers3 className="mt-0.5 h-4 w-4 text-[color:var(--ember)]" />
        <div>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Configurateur table
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Le MOQ s'applique à la combinaison complète : format, plateau et finition pied.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="label-eyebrow mb-2 text-muted-foreground">
            Format plateau
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TABLE_SHAPES.map((shape) => {
              const selected = shape.id === shapeId;
              return (
                <button
                  key={shape.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setShapeId(shape.id)}
                  className={`min-h-[72px] rounded-sm border p-3 text-left transition-colors ${
                    selected
                      ? "border-foreground bg-[color:var(--sand)]"
                      : "border-[color:var(--sand-deep)] hover:border-foreground/40"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-semibold tracking-tight">
                      {shape.title}
                    </span>
                    {selected && <Check className="h-4 w-4" />}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {shape.meta}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {shapeId !== "base-only" && (
          <VariantSelector
            variants={product.variants}
            selectedVariantId={variantId}
            onChange={onVariantChange}
            showLabel
          />
        )}

        <div>
          <div className="label-eyebrow mb-2 text-muted-foreground">Finition pied</div>
          <div className="grid grid-cols-2 gap-2">
            {FOOT_FINISHES.map((finish) => {
              const selected = finish.id === footFinishId;
              return (
                <button
                  key={finish.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFootFinishId(finish.id)}
                  className={`flex min-h-11 items-center gap-2 rounded-sm border px-3 text-sm transition-colors ${
                    selected
                      ? "border-foreground bg-[color:var(--sand)]"
                      : "border-[color:var(--sand-deep)] hover:border-foreground/40"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-foreground/15"
                    style={{ backgroundColor: finish.hex }}
                  />
                  {finish.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-eyebrow text-muted-foreground">Prix config.</span>
            <span className="font-display text-lg font-semibold tabular-nums">
              {formatEUR(adjustedPrice)}
            </span>
          </div>
          <div className="mt-1 text-muted-foreground">{configurationCode}</div>
        </div>
      </div>
    </div>
  );
}
