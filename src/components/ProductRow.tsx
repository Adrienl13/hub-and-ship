import { Minus, Plus, Check, AlertCircle, Info } from "lucide-react";
import {
  type Product,
  type ColorOption,
  unitCBM,
  findOption,
} from "@/lib/products";
import { Button } from "@/components/ui/button";

/** Fond CSS reproduisant la trame d'un échantillon (chevron, diamond, weave, check, stripe) */
function swatchBackground(opt: { hex: string; hex2?: string; pattern?: string }): string {
  const a = opt.hex;
  const b = opt.hex2 ?? "#ffffff";
  switch (opt.pattern) {
    case "chevron":
      return `repeating-linear-gradient(135deg, ${a} 0 3px, ${b} 3px 6px), repeating-linear-gradient(45deg, ${a} 0 3px, ${b} 3px 6px)`;
    case "diamond":
      return `repeating-linear-gradient(45deg, ${a} 0 2px, ${b} 2px 5px), repeating-linear-gradient(-45deg, ${a} 0 2px, ${b} 2px 5px)`;
    case "weave":
      return `repeating-linear-gradient(0deg, ${a} 0 2px, ${b} 2px 4px), repeating-linear-gradient(90deg, ${a} 0 2px, ${b} 2px 4px)`;
    case "check":
      return `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0/8px 8px`;
    case "stripe":
      return `repeating-linear-gradient(90deg, ${a} 0 4px, ${b} 4px 7px)`;
    default:
      return a;
  }
}

function Swatch({
  opt,
  size = 24,
  selected = false,
  onClick,
}: {
  opt: ColorOption;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const bg = swatchBackground(opt);
  const isPattern = !!opt.pattern && opt.pattern !== "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${opt.name}${opt.code ? ` · ${opt.code}` : ""}`}
      aria-label={opt.name}
      className={`relative shrink-0 overflow-hidden rounded-full ring-1 ring-black/15 transition-all hover:scale-110 ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
      }`}
      style={{
        width: size,
        height: size,
        background: isPattern ? bg : opt.hex,
        backgroundSize: opt.pattern === "check" ? "8px 8px" : undefined,
      }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Check className="h-3 w-3 text-white" />
        </span>
      )}
    </button>
  );
}

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
  const moq = product.moq;
  const savingsPct = Math.round((1 - product.price / product.retailPrice) * 100);
  const activeOpt = findOption(product, optionId);
  const swatchHex = activeOpt?.hex ?? product.swatch;

  const handlePlus = () => {
    if (qty === 0) onChange(moq); // premier ajout = MOQ
    else onChange(qty + step);
  };
  const handleMinus = () => {
    if (qty <= moq) onChange(0); // descend sous MOQ → retire la ligne
    else onChange(Math.max(moq, qty - step));
  };
  const belowMoq = qty > 0 && qty < moq;

  return (
    <div className="group rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5"
          style={{
            background: activeOpt
              ? swatchBackground(activeOpt)
              : swatchHex,
            backgroundSize: activeOpt?.pattern === "check" ? "8px 8px" : undefined,
          }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-black/15" />
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
            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
              MOQ {moq}
            </span>
            <span className="truncate">{product.blurb}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleMinus}
            disabled={qty === 0}
            aria-label="Retirer"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <div className="w-10 text-center text-sm font-semibold tabular-nums">
            {qty}
          </div>
          <Button
            size="icon"
            className="h-8 w-8"
            onClick={handlePlus}
            aria-label={qty === 0 ? `Ajouter (min. ${moq})` : `Ajouter ${step}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {product.customizations && product.customizations.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
          {product.customizations.map((group) => {
            const activeInGroup = group.options.find((o) => o.id === optionId);
            return (
              <div key={group.kind} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {activeInGroup && (
                    <div className="text-[10px] tabular-nums text-foreground/70">
                      {activeInGroup.code ? `${activeInGroup.code} · ` : ""}
                      {activeInGroup.name}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {group.options.map((opt) => (
                    <Swatch
                      key={opt.id}
                      opt={opt}
                      selected={opt.id === optionId}
                      onClick={() => onOptionChange(opt.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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

      {belowMoq && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          Quantité minimum : {moq} unités
        </div>
      )}
    </div>
  );
}
