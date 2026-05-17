import { Ruler, Weight, Package, Flame, ShieldCheck, TrendingDown, Check } from "lucide-react";
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CATEGORY_LABEL, type ColorVariant, type Product } from "@/lib/products";
import { getMoqStatus, formatEUR } from "@/lib/order";
import { TableConfigurator } from "@/components/TableConfigurator";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductDocumentsList } from "@/components/ProductDocumentsList";
import { ProductReviews } from "@/components/ProductReviews";
import { QuantityStepper } from "@/components/QuantityStepper";
import { getQuantityRule } from "@/lib/quantity";

function BigSwatch({
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
      aria-pressed={selected}
      title={variant.name}
      className={`group relative h-14 w-14 overflow-hidden rounded-sm ring-1 ring-foreground/15 transition-all hover:scale-105 ${
        selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
      }`}
      style={{ background: variant.hex }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  qty,
  variantId,
  onQtyChange,
  onVariantChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  qty: number;
  variantId: string;
  onQtyChange: (n: number) => void;
  onVariantChange: (id: string) => void;
}) {
  const variant = useMemo(
    () => (product ? product.variants.find((v) => v.id === variantId) ?? product.variants[0] : null),
    [product, variantId],
  );

  if (!product || !variant) return null;

  const savingsPct = Math.round((1 - product.basePriceHt / product.retailPriceRef) * 100);
  const savingsEur = product.retailPriceRef - product.basePriceHt;
  const moqStatus = getMoqStatus(variant.unitsCommitted + qty, product.moqUnits);
  const totalLine = product.basePriceHt * qty;
  const lineCbm = product.cbmPerUnit * qty;
  const quantityRule = getQuantityRule(product);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[color:var(--sand-soft)] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="label-eyebrow rounded-sm bg-muted px-2 py-0.5 text-foreground/70">
              {CATEGORY_LABEL[product.category]}
            </span>
            <span className="label-eyebrow rounded-sm bg-[color:var(--ember)]/10 px-2 py-0.5 text-[color:var(--ember)]">
              −{savingsPct}% vs retail
            </span>
            <span className="label-eyebrow text-muted-foreground">{product.sku}</span>
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/70">
            {product.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Galerie */}
          <div className="space-y-2">
            <ProductGallery product={product} />

            {/* Specs */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              {[
                { Icon: Ruler, k: "Dimensions", v: `${product.dimensions.l}×${product.dimensions.w}×${product.dimensions.h} cm` },
                { Icon: Weight, k: "Poids", v: `${product.weightKg} kg` },
                { Icon: Package, k: "Volume", v: `${product.cbmPerUnit.toFixed(3)} m³` },
                { Icon: ShieldCheck, k: "MOQ", v: `${product.moqUnits} unités` },
              ].map(({ Icon, k, v }) => (
                <div
                  key={k}
                  className="rounded-sm border border-[color:var(--sand-deep)] bg-card p-2.5"
                >
                  <div className="label-eyebrow flex items-center gap-1 text-muted-foreground">
                    <Icon className="h-3 w-3" /> {k}
                  </div>
                  <div className="mt-0.5 text-sm font-medium tabular-nums">{v}</div>
                </div>
              ))}
            </div>

            {product.fireRating && (
              <div className="flex items-center gap-2 rounded-sm border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/5 px-3 py-2 text-xs">
                <Flame className="h-3.5 w-3.5 text-[color:var(--ember)]" />
                <span>
                  Classement feu <strong>{product.fireRating}</strong> · conforme ERP
                </span>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Prix */}
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="flex items-baseline gap-3">
                <div className="font-display text-3xl font-semibold tabular-nums">
                  {formatEUR(product.basePriceHt)}
                </div>
                <div className="text-sm text-muted-foreground line-through tabular-nums">
                  {formatEUR(product.retailPriceRef)}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 text-[color:var(--ember)]" />
                Économie <span className="font-medium text-[color:var(--ember)]">{formatEUR(savingsEur)}</span> par unité
              </div>
            </div>

            {product.category === "table" ? (
              <TableConfigurator
                product={product}
                variantId={variantId}
                onVariantChange={onVariantChange}
              />
            ) : (
              <div>
                <div className="label-eyebrow mb-2 text-muted-foreground">
                  Couleur · {variant.name}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {product.variants.map((v) => (
                    <BigSwatch
                      key={v.id}
                      variant={v}
                      selected={v.id === variantId}
                      onClick={() => onVariantChange(v.id)}
                    />
                  ))}
                </div>
                <div className="mt-3 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-2.5 text-xs">
                  <span className="font-medium">MOQ {variant.name} :</span>{" "}
                  <span className="tabular-nums">
                    {variant.unitsCommitted + qty} / {product.moqUnits}
                  </span>{" "}
                  <span className="text-muted-foreground">— {moqStatus.label}</span>
                </div>
              </div>
            )}

            {/* Caractéristiques */}
            <div>
              <div className="label-eyebrow mb-1.5 text-muted-foreground">Caractéristiques</div>
              <ul className="grid grid-cols-1 gap-1 text-xs text-foreground/80">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--forest)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <ProductDocumentsList product={product} />

            <ProductReviews product={product} />

            {/* Quantité */}
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-medium">Quantité</div>
                  <div className="text-muted-foreground">
                    {quantityRule.label} · MOQ {product.moqUnits}
                  </div>
                </div>
                <QuantityStepper
                  value={qty}
                  onChange={onQtyChange}
                  size="lg"
                  rule={quantityRule}
                />
              </div>
              {qty > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--sand-deep)] pt-2 text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {qty} unités · {lineCbm.toFixed(2)} m³
                  </span>
                  <span className="font-display text-xl font-semibold tabular-nums">
                    {formatEUR(totalLine)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
