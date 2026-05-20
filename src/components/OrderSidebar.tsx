import { Suspense, lazy, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  FileText,
  Mail,
  Lock,
  ShieldCheck,
  RefreshCcw,
  Truck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CartItem, type OrderTotals, formatEUR } from "@/lib/order";
import { AnimatedNumber } from "@/components/motion-helpers";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const ContainerScene = lazy(() =>
  import("@/components/ContainerScene").then((m) => ({ default: m.ContainerScene })),
);

function ContainerScenePlaceholder({ label }: { label?: string }) {
  return (
    <div
      className="h-[320px] w-full animate-pulse rounded-md bg-[color:var(--sand-soft)]"
      aria-label={label ?? "Chargement de la vue 3D du container"}
      role="img"
    />
  );
}

function ContainerSceneStatic() {
  return (
    <div
      className="flex h-[320px] w-full items-center justify-center rounded-md bg-[color:var(--sand-soft)] text-xs text-muted-foreground"
      role="img"
      aria-label="Vue du container (animations désactivées)"
    >
      Vue 3D désactivée (préférence système : animations réduites)
    </div>
  );
}

export function OrderSidebar({
  items,
  totals,
  fillPercent,
  usedCbm,
  capacity,
  containerRef,
  port,
  seriesReached,
  totalSeries,
  professionalsEngaged,
  onReserve,
  onDownloadPdf,
  onEmailQuote,
}: {
  items: CartItem[];
  totals: OrderTotals;
  fillPercent: number;
  usedCbm: number;
  capacity: number;
  containerRef: string;
  port: string;
  seriesReached: number;
  totalSeries: number;
  professionalsEngaged: number;
  onReserve: () => void;
  onDownloadPdf: () => void;
  onEmailQuote: () => void;
}) {
  const [exploded, setExploded] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasItems = items.length > 0;

  return (
    <div className="sticky top-20 space-y-3">
      {/* 3D scene + meta */}
      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="flex items-center justify-between border-b border-[color:var(--sand-deep)] px-4 py-2.5">
          <div>
            <div className="font-display text-sm font-semibold tracking-tight">{containerRef}</div>
            <div className="text-[11px] text-muted-foreground">{port} · 20' High Cube</div>
          </div>
          <Button
            variant={exploded ? "default" : "outline"}
            size="sm"
            className="h-7 gap-1 rounded-sm border-[color:var(--sand-deep)] px-2 text-[11px]"
            onClick={() => setExploded((v) => !v)}
          >
            {exploded ? (
              <>
                <Minimize2 className="h-3 w-3" /> Regrouper
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" /> Vue éclatée
              </>
            )}
          </Button>
        </div>
        <div className="relative h-[320px] w-full bg-[color:var(--sand)]">
          {prefersReducedMotion ? (
            <ContainerSceneStatic />
          ) : (
            <Suspense fallback={<ContainerScenePlaceholder />}>
              <ContainerScene items={items} exploded={exploded} />
            </Suspense>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-px bg-[color:var(--sand-deep)] text-xs">
          <div className="bg-card p-3">
            <div className="label-eyebrow text-muted-foreground">Volume</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-base font-semibold tabular-nums">
                <AnimatedNumber value={fillPercent} suffix="%" />
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {usedCbm.toFixed(2)} / {capacity} m³
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
              <motion.div
                className="h-full bg-foreground"
                initial={false}
                animate={{ width: `${fillPercent}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 22 }}
              />
            </div>
          </div>
          <div className="bg-card p-3">
            <div className="label-eyebrow text-muted-foreground">Séries</div>
            <div className="mt-1 font-display text-base font-semibold tabular-nums">
              {seriesReached}/{totalSeries}
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                déclenchées
              </span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {professionalsEngaged} pros engagés
            </div>
          </div>
        </div>
      </div>

      {/* Récap */}
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="border-b border-[color:var(--sand-deep)] px-4 py-3">
          <div className="label-eyebrow text-muted-foreground">Votre commande</div>
        </div>

        {hasItems ? (
          <ul className="divide-y divide-[color:var(--sand-deep)]/60">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={`${item.product.id}:${item.variant.id}`}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full ring-1 ring-foreground/15"
                      style={{ background: item.variant.hex }}
                    />
                    <span className="truncate">
                      <span className="font-medium tabular-nums">{item.quantity}× </span>
                      {item.product.name}
                      <span className="text-muted-foreground"> · {item.variant.name}</span>
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatEUR(item.product.basePriceHt * item.quantity)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Sélectionnez des produits dans le catalogue pour démarrer.
          </div>
        )}

        {hasItems && (
          <motion.div
            layout
            className="space-y-1 border-t border-[color:var(--sand-deep)] px-4 py-3 text-xs"
          >
            <AnimRow label="Sous-total HT" value={totals.subtotalHt} />
            <AnimRow
              label="Frais réservation (3%)"
              value={totals.reservationFee}
              hint="min 150€ / max 500€"
            />
            <div className="my-2 h-px bg-[color:var(--sand-deep)]" />
            <AnimRow label="À payer aujourd'hui" value={totals.payNow} bold />
            <AnimRow label="Acompte à 80%" value={totals.payAt80Percent} muted />
            <AnimRow label="Solde avant livraison" value={totals.payBeforeShipping} muted />
            {totals.savings > 0 && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 -mx-4 -mb-3 rounded-b-md bg-[color:var(--sand)] px-4 py-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80">Économie totale</span>
                  <span className="font-display text-base font-semibold tabular-nums text-[color:var(--ember)]">
                    −<AnimatedNumber value={totals.savings} format={(n) => formatEUR(n)} />
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          onClick={onReserve}
          disabled={!hasItems}
        >
          Confirmer ma réservation
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-sm border-[color:var(--sand-deep)] text-xs"
            onClick={onDownloadPdf}
            disabled={!hasItems}
          >
            <FileText className="h-3.5 w-3.5" />
            Devis PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-sm border-[color:var(--sand-deep)] text-xs"
            onClick={onEmailQuote}
            disabled={!hasItems}
          >
            <Mail className="h-3.5 w-3.5" />
            Par email
          </Button>
        </div>
      </div>

      {/* Trust */}
      <ul className="space-y-1.5 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-[11px] text-foreground/75">
        {[
          { Icon: RefreshCcw, t: "Remboursement 100% si Container Club annule" },
          { Icon: Lock, t: "Paiement Stripe sécurisé · 3D Secure" },
          { Icon: ShieldCheck, t: "Contrôle qualité SGS indépendant avant départ" },
          { Icon: Truck, t: "Forfait livraison clair par zone géographique" },
        ].map(({ Icon, t }) => (
          <li key={t} className="flex items-start gap-2">
            <Icon className="mt-0.5 h-3 w-3 shrink-0 text-foreground/50" strokeWidth={1.5} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnimRow({
  label,
  value,
  bold,
  muted,
  hint,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? "text-muted-foreground" : "text-foreground/80"}>
        {label}
        {hint && <span className="ml-1 text-[10px] text-muted-foreground">({hint})</span>}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-display text-base font-semibold" : muted ? "text-muted-foreground" : "font-medium"}`}
      >
        <AnimatedNumber value={value} format={(n) => formatEUR(n)} />
      </span>
    </div>
  );
}
