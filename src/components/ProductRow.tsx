import { Minus, Plus, Check } from "lucide-react";
import { type Product, unitCBM } from "@/lib/products";
import { Button } from "@/components/ui/button";

export function ProductRow({
  product,
  qty,
  optionId,
  onChange,
  onOptionChange,
}: {
  product: Product;
  qty: number;
  optionId?: string;
  onChange: (next: number) => void;
  onOptionChange: (id: string) => void;
}) {
  const cbm = unitCBM(product);
  const lineCBM = cbm * qty;
  const step = product.packQty;
  const savingsPct = Math.round((1 - product.price / product.retailPrice) * 100);
  const swatchHex =
    product.customization?.options.find((o) => o.id === optionId)?.hex ??
    product.swatch;

  return (
    <div className="group rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5 transition-colors"
          style={{ backgroundColor: swatchHex }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-black/15" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-sm font-medium text-foreground">
              {product.name}
            </div>
            <div className="flex shrink-0 items-baseline gap-1.5">
              <span className="text-[11px] text-muted-foreground line-through tabular-nums">
                €{product.retailPrice}
              </span>
              <span className="text-sm font-semibold tabular-nums text-primary">
                €{product.price}
              </span>
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              −{savingsPct}%
            </span>
            <span className="truncate">{product.blurb}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(Math.max(0, qty - step))}
            aria-label={`Retirer ${step} ${product.name}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <div className="w-8 text-center text-sm font-semibold tabular-nums">
            {qty}
          </div>
          <Button
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(qty + step)}
            aria-label={`Ajouter ${step} ${product.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {product.customization && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {product.customization.label}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {product.customization.options.map((opt) => {
              const selected = opt.id === optionId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onOptionChange(opt.id)}
                  title={opt.name}
                  aria-label={opt.name}
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/10 transition-all hover:scale-110 ${
                    selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                  }`}
                  style={{ backgroundColor: opt.hex }}
                >
                  {selected && (
                    <Check
                      className="h-3 w-3"
                      style={{
                        color:
                          parseInt(opt.hex.slice(1, 3), 16) +
                            parseInt(opt.hex.slice(3, 5), 16) +
                            parseInt(opt.hex.slice(5, 7), 16) >
                          380
                            ? "#000"
                            : "#fff",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {qty > 0 && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {qty / step} carton{qty / step > 1 ? "s" : ""} · {cbm.toFixed(3)} m³ / unité
          </span>
          <span className="tabular-nums text-primary">{lineCBM.toFixed(2)} m³</span>
        </div>
      )}
    </div>
  );
}
