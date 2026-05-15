import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/order";

export function MobileStickyBar({
  totalItems,
  fillPercent,
  subtotalHt,
  onReserve,
}: {
  totalItems: number;
  fillPercent: number;
  subtotalHt: number;
  onReserve: () => void;
}) {
  if (totalItems <= 0) return null;
  return (
    <div className="sticky bottom-0 z-30 border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1 text-[11px] leading-tight">
          <div className="font-medium tabular-nums">
            {totalItems} produits · {fillPercent.toFixed(0)}% rempli
          </div>
          <div className="text-muted-foreground tabular-nums">
            {formatEUR(subtotalHt)} HT
          </div>
        </div>
        <Button
          size="sm"
          className="h-10 shrink-0 rounded-sm bg-foreground px-4 text-background hover:bg-foreground/90"
          onClick={onReserve}
        >
          Réserver <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
