import type { CartItem } from "@/lib/order";
import { packContainerPackages } from "@/lib/container/packing";

export function ContainerScene3DFallback({
  items,
  fillPercent,
}: {
  items: CartItem[];
  fillPercent: number;
}) {
  const packed = packContainerPackages(items);
  const totalPackages = packed.packages.length;
  const safeFill = Math.max(0, Math.min(100, fillPercent));

  return (
    <div className="absolute inset-0 grid place-items-center bg-[color:var(--sand)] p-5">
      <div className="w-full max-w-[260px]">
        <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Fallback 2D</span>
          <span className="tabular-nums">{safeFill.toFixed(0)}%</span>
        </div>
        <div className="relative h-28 overflow-hidden rounded-sm border-2 border-foreground/35 bg-[color:var(--sand-soft)]">
          <div className="absolute inset-y-3 left-3 right-5 flex items-end gap-1">
            {items.length === 0 ? (
              <div className="h-full w-full rounded-sm border border-dashed border-[color:var(--sand-deep)]" />
            ) : (
              packed.slices.map((slice) => {
                const share =
                  totalPackages > 0
                    ? (slice.packageCount / totalPackages) * safeFill
                    : 0;
                return (
                  <div
                    key={slice.productId}
                    className="min-w-2 rounded-t-sm ring-1 ring-black/10"
                    style={{
                      width: `${Math.max(4, share)}%`,
                      height: `${Math.max(22, Math.min(95, 35 + slice.packageCount * 8))}%`,
                      backgroundColor: slice.color,
                    }}
                    title={`${slice.productName}: ${slice.packageCount} pile/carton`}
                  />
                );
              })
            )}
          </div>
          <div className="absolute right-1 top-1/2 h-12 w-3 -translate-y-1/2 rounded-sm border border-foreground/30 bg-background/50" />
        </div>
        <div className="mt-2 text-center text-[10px] text-muted-foreground">
          Aperçu logistique par piles/cartons.
          {packed.overflowUnits > 0
            ? ` ${packed.overflowUnits} unité(s) hors capacité.`
            : ""}
        </div>
      </div>
    </div>
  );
}
