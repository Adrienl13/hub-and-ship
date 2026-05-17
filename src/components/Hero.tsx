import { ShieldCheck, Award, FileBadge } from "lucide-react";
import { motion } from "framer-motion";
import { CURRENT_CONTAINER } from "@/lib/products";
import { AnimatedNumber } from "@/components/motion-helpers";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Hero({
  fillPercent,
  seriesReached,
  totalSeries,
  professionalsEngaged,
}: {
  fillPercent: number;
  seriesReached: number;
  totalSeries: number;
  professionalsEngaged: number;
}) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-12 sm:pt-16">
        {/* Bandeau pré-header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 inline-flex items-center gap-2 rounded-sm border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/8 px-3 py-1.5 text-xs"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--forest)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--forest)]" />
          </span>
          <span className="font-medium text-foreground">
            Container {CURRENT_CONTAINER.reference} ouvert
          </span>
          <span className="text-foreground/60">·</span>
          <span className="text-foreground/70">Destination {CURRENT_CONTAINER.port}</span>
          <span className="text-foreground/60">·</span>
          <span className="text-foreground/70">
            Clôture estimée {formatDate(CURRENT_CONTAINER.expectedCloseAt)}
          </span>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Texte */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="lg:col-span-7"
          >
            <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
              Mobilier outdoor pro,
              <br />
              <span className="text-[color:var(--ember)]">direct usine,</span>
              <br />
              sans intermédiaire.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)]">
              Pré-commande groupée par container 20' avec d'autres professionnels.
              Jusqu'à <strong className="font-semibold text-foreground">−40%</strong> vs
              retail français. Importation, douane et garantie 2 ans incluses.
            </p>

            {/* Chips réassurance */}
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                { Icon: FileBadge, label: "Importateur officiel français" },
                { Icon: Award, label: "Contrôle qualité SGS avant expédition" },
                { Icon: ShieldCheck, label: "Garantie 2 ans + SAV France" },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-1.5 text-xs text-foreground/80"
                >
                  <Icon className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Mini-card container */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-5 shadow-paper">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow text-muted-foreground">Container en cours</span>
                <span className="label-eyebrow rounded-sm bg-[color:var(--forest)]/12 px-2 py-0.5 text-[color:var(--forest)]">
                  Ouvert
                </span>
              </div>
              <div className="mt-3 font-display text-xl font-semibold tracking-tight">
                {CURRENT_CONTAINER.reference}
              </div>
              <div className="text-xs text-muted-foreground">
                Destination {CURRENT_CONTAINER.port} · 20' High Cube
              </div>

              {/* Progress */}
              <div className="mt-5">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">Remplissage</span>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    <AnimatedNumber value={fillPercent} suffix="%" />
                  </span>
                </div>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
                  <motion.div
                    className="h-full bg-[color:var(--foreground)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPercent}%` }}
                    transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                  />
                  <motion.div
                    className="absolute inset-y-[-3px] w-[40%] -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    animate={{ x: ["-100%", "260%"] }}
                    transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.4 }}
                  />
                  <div
                    className="absolute inset-y-0 w-px bg-[color:var(--ember)]"
                    style={{ left: `${CURRENT_CONTAINER.thresholdPercent}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>Seuil départ {CURRENT_CONTAINER.thresholdPercent}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[color:var(--sand-deep)] pt-4 text-xs">
                <div>
                  <div className="label-eyebrow text-muted-foreground">Séries</div>
                  <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
                    <AnimatedNumber value={seriesReached} />/{totalSeries}
                  </div>
                </div>
                <div>
                  <div className="label-eyebrow text-muted-foreground">Pros engagés</div>
                  <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
                    <AnimatedNumber value={professionalsEngaged} />
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
