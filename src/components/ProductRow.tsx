import { Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/products";
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
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40">
      <div
        className="h-10 w-10 shrink-0 rounded-md ring-1 ring-black/5"
        style={{ backgroundColor: product.swatch }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">{product.name}</div>
        <div className="text-xs text-muted-foreground">
          €{product.price} · {product.cbm.toFixed(3)} CBM/u
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(Math.max(0, qty - 1))}
          aria-label={`Remove one ${product.name}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <div className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</div>
        <Button
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(qty + 1)}
          aria-label={`Add one ${product.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
