import { Minus, Plus, Package, Ruler, ShieldCheck, TrendingDown, Boxes } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type Product,
  type ColorOption,
  unitCBM,
  findOption,
} from "@/lib/products";

function swatchBackground(opt: { hex: string; hex2?: string; pattern?: string }): string {
  const a = opt.hex;
  const b = opt.hex2 ?? "#ffffff";
  switch (opt.pattern) {
    case "chevron":
      return `repeating-linear-gradient(135deg, ${a} 0 4px, ${b} 4px 8px), repeating-linear-gradient(45deg, ${a} 0 4px, ${b} 4px 8px)`;
    case "diamond":
      return `repeating-linear-gradient(45deg, ${a} 0 3px, ${b} 3px 6px), repeating-linear-gradient(-45deg, ${a} 0 3px, ${b} 3px 6px)`;
    case "weave":
      return `repeating-linear-gradient(0deg, ${a} 0 3px, ${b} 3px 6px), repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 6px)`;
    case "check":
      return `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0/12px 12px`;
    case "stripe":
      return `repeating-linear-gradient(90deg, ${a} 0 5px, ${b} 5px 9px)`;
    default:
      return a;
  }
}

function BigSwatch({
  opt,
  selected,
  onClick,
}: {
  opt: ColorOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg ring-1 ring-black/10 transition-all hover:scale-[1.03] ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
      }`}
      style={{ aspectRatio: "1 / 1" }}
      title={`${opt.name}${opt.code ? ` · ${opt.code}` : ""}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: swatchBackground(opt),
          backgroundSize: opt.pattern === "check" ? "12px 12px" : undefined,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
        <div className="text-[10px] font-medium leading-tight text-white">{opt.name}</div>
        {opt.code && (
          <div className="text-[9px] text-white/70 tabular-nums">{opt.code}</div>
        )}
      </div>
    </button>
  );
}

export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  qty,
  optionId,
  onChange,
  onOptionChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  qty: number;
  optionId?: string;
  onChange: (n: number) => void;
  onOptionChange: (id: string) => void;
}) {
  if (!product) return null;
  const cbm = unitCBM(product);
  const lineCBM = cbm * qty;
  const step = product.packQty;
  const moq = product.moq;
  const savingsPct = Math.round((1 - product.price / product.retailPrice) * 100);
  const savingsEUR = product.retailPrice - product.price;
  const activeOpt = findOption(product, optionId);
  const heroBg = activeOpt
    ? swatchBackground(activeOpt)
    : product.swatch;
  const [pw, pd, ph] = product.packDim;

  const handlePlus = () => onChange(qty === 0 ? moq : qty + step);
  const handleMinus = () => onChange(qty <= moq ? 0 : Math.max(moq, qty - step));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">{product.category}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              −{savingsPct}% vs. retail
            </span>
          </div>
          <DialogTitle className="font-display text-2xl">{product.name}</DialogTitle>
          <DialogDescription>{product.blurb}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Hero swatch preview */}
          <div className="space-y-3">
            <div
              className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-black/10"
              style={{
                background: heroBg,
                backgroundSize: activeOpt?.pattern === "check" ? "16px 16px" : undefined,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30" />
              <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                {activeOpt ? `${activeOpt.code ? activeOpt.code + " · " : ""}${activeOpt.name}` : "Finition standard"}
              </div>
            </div>

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Ruler className="h-3 w-3" /> Carton
                </div>
                <div className="mt-0.5 font-medium tabular-nums">
                  {pw}×{pd}×{ph} m
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Boxes className="h-3 w-3" /> Par carton
                </div>
                <div className="mt-0.5 font-medium tabular-nums">×{step} unités</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Package className="h-3 w-3" /> CBM / unité
                </div>
                <div className="mt-0.5 font-medium tabular-nums">
                  {cbm.toFixed(3)} m³
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> MOQ
                </div>
                <div className="mt-0.5 font-medium tabular-nums">{moq} unités</div>
              </div>
            </div>
          </div>

          {/* Right column: prix + customization + qty */}
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
              <div className="flex items-baseline gap-3">
                <div className="font-display text-3xl tabular-nums text-primary">
                  €{product.price}
                </div>
                <div className="text-sm text-muted-foreground line-through tabular-nums">
                  €{product.retailPrice}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 text-primary" />
                Économie de <span className="font-medium text-primary">€{savingsEUR}</span> par unité vs. grossiste FR
              </div>
            </div>

            {product.customizations?.map((group) => (
              <div key={group.kind} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {group.options.length} options
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {group.options.map((opt) => (
                    <BigSwatch
                      key={opt.id}
                      opt={opt}
                      selected={opt.id === optionId}
                      onClick={() => onOptionChange(opt.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Qty stepper + line total */}
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-medium">Quantité</div>
                  <div className="text-muted-foreground">
                    Pas de {step} · min. {moq}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleMinus}
                    disabled={qty === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="w-12 text-center font-display text-lg tabular-nums">
                    {qty}
                  </div>
                  <Button size="icon" className="h-9 w-9" onClick={handlePlus}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {qty > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {qty / step} cartons · {lineCBM.toFixed(2)} m³
                  </span>
                  <span className="font-display text-xl tabular-nums text-primary">
                    €{(product.price * qty).toLocaleString("fr-FR")}
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
