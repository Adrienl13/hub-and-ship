import { Minus, Plus } from "lucide-react";
import { type Product, unitCBM } from "@/lib/products";
import { Button } from "@/components/ui/button";

export function ProductRow({
  product,
  qty,
  onChange,
}: {
  product: Product;
  qty: number;
  onChange: (next: number) => void;
}) {
  const cbm = unitCBM(product);
  const lineCBM = cbm * qty;
  const step = product.packQty;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-all hover:border-primary/40 hover:shadow-sm">
      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5"
        style={{ backgroundColor: product.swatch }}
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate font-medium text-foreground">{product.name}</div>
          <div className="shrink-0 text-sm font-semibold tabular-nums">€{product.price}</div>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{product.blurb}</span>
          <span className="text-border">·</span>
          <span className="tabular-nums">{cbm.toFixed(3)} CBM/u</span>
          {qty > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="tabular-nums text-primary">{lineCBM.toFixed(2)} CBM</span>
            </>
          )}
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
        <div className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</div>
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
  );
}
