import { Check } from "lucide-react";

export function SeriesProgressIndicator({
  reached,
  total,
  required,
}: {
  reached: number;
  total: number;
  required: number;
}) {
  const safeTotal = Math.max(1, total);
  const safeReached = Math.max(0, Math.min(reached, safeTotal));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="label-eyebrow text-muted-foreground">Séries</span>
        <span className="font-display text-sm font-semibold tabular-nums">
          {safeReached}/{safeTotal}
        </span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${safeTotal}, minmax(0, 1fr))` }}>
        {Array.from({ length: safeTotal }).map((_, index) => {
          const done = index < safeReached;
          const requiredMarker = index + 1 === required;
          return (
            <span
              key={index}
              className={`relative grid h-7 place-items-center rounded-sm border text-[10px] ${
                done
                  ? "border-[color:var(--forest)] bg-[color:var(--forest)]/10 text-[color:var(--forest)]"
                  : "border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-muted-foreground"
              }`}
              title={requiredMarker ? "Minimum de séries requis" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              {requiredMarker && (
                <span className="absolute -bottom-1 left-1/2 h-1.5 w-px -translate-x-1/2 bg-[color:var(--ember)]" />
              )}
            </span>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        Minimum production : {required} séries confirmées.
      </div>
    </div>
  );
}
