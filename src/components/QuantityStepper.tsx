import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuantityStepper({
  value,
  onChange,
  size = "sm",
}: {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "lg";
}) {
  const buttonSize = size === "lg" ? "h-11 w-11" : "h-7 w-7";
  const inputSize = size === "lg" ? "h-11 w-16 text-base" : "w-12 text-sm";

  return (
    <div className="flex items-center gap-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={`${buttonSize} rounded-sm hover:bg-background`}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label="Diminuer"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <input
        type="number"
        value={value}
        onChange={(event) =>
          onChange(Math.max(0, Number.parseInt(event.target.value || "0", 10)))
        }
        className={`${inputSize} bg-transparent text-center font-semibold tabular-nums focus:outline-none`}
        aria-label="Quantité"
        min={0}
      />
      <Button
        variant="ghost"
        size="icon"
        className={`${buttonSize} rounded-sm hover:bg-background`}
        onClick={() => onChange(value + 1)}
        aria-label="Augmenter"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
