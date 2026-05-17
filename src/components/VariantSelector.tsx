import { Check } from "lucide-react";

import type { ColorVariant } from "@/lib/products";

function ColorDot({
  variant,
  selected,
  onClick,
  size,
}: {
  variant: ColorVariant;
  selected: boolean;
  onClick: () => void;
  size: "sm" | "lg";
}) {
  const dimensions = size === "lg" ? "h-8 w-8" : "h-6 w-6";
  const iconSize = size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <button
      type="button"
      onClick={onClick}
      title={variant.name}
      aria-label={variant.name}
      aria-pressed={selected}
      className={`relative ${dimensions} shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/15 transition-all hover:scale-110 ${
        selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
      }`}
      style={{ background: variant.hex }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Check className={`${iconSize} text-white drop-shadow`} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onChange,
  size = "sm",
}: {
  variants: ColorVariant[];
  selectedVariantId: string;
  onChange: (variantId: string) => void;
  size?: "sm" | "lg";
}) {
  const selected = variants.find((variant) => variant.id === selectedVariantId);

  return (
    <div>
      <div className="label-eyebrow mb-2 text-muted-foreground">Couleur</div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {variants.map((variant) => (
          <ColorDot
            key={variant.id}
            variant={variant}
            selected={variant.id === selectedVariantId}
            onClick={() => onChange(variant.id)}
            size={size}
          />
        ))}
      </div>
      {selected && (
        <div className="mt-1 text-xs text-foreground/80">
          Sélectionné : <span className="font-medium">{selected.name}</span>
        </div>
      )}
    </div>
  );
}
