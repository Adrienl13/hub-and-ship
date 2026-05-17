import { motion } from "framer-motion";

import { AnimatedNumber } from "@/components/motion-helpers";

export function ContainerFillBar({
  percent,
  usedCbm,
  capacity,
  thresholdPercent,
  compact = false,
}: {
  percent: number;
  usedCbm: number;
  capacity: number;
  thresholdPercent: number;
  compact?: boolean;
}) {
  const safePercent = Math.max(0, Math.min(100, percent));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="label-eyebrow text-muted-foreground">Remplissage</span>
        <span className="font-display font-semibold tabular-nums">
          <AnimatedNumber value={safePercent} suffix="%" />
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
        <motion.div
          className="h-full rounded-full bg-[color:var(--foreground)]"
          initial={false}
          animate={{ width: `${safePercent}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 22 }}
        />
        <div
          className="absolute inset-y-[-3px] w-px bg-[color:var(--ember)]"
          style={{ left: `${thresholdPercent}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between gap-3 text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {usedCbm.toFixed(2)} / {capacity} m3
          </span>
          <span>Départ à {thresholdPercent}%</span>
        </div>
      )}
    </div>
  );
}
