import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  Ship,
  Factory,
  Truck,
  Clock,
  Users,
  Sparkles,
  Container as ContainerIcon,
  Anchor,
  TrendingDown,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  FileText,
  Mail,
  Lock,
  RefreshCcw,
  CheckCircle2,
  Phone,
  HelpCircle,
} from "lucide-react";
import { openQuotePDF } from "@/lib/quote";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ContainerScene } from "@/components/ContainerScene";
import { ProductRow } from "@/components/ProductRow";
import { ProductDetailDialog } from "@/components/ProductDetailDialog";
import {
  CONTAINER_CBM,
  PRODUCTS,
  type Product,
  unitCBM,
  getProductColor,
  defaultOptionId,
  findOption,
} from "@/lib/products";

const CATEGORIES = ["Tous", "Chaise", "Fauteuil", "Tabouret", "Table"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];
type SortKey = "default" | "price-asc" | "price-desc" | "cbm-asc";

export const Route = createFileRoute("/")({
  component: ContainerClubPage,
});

const FAKE_BUYERS = [
  { initials: "MR", name: "Marie · Café du Marais", city: "Paris 4e", items: "20 chaises rotin" },
  { initials: "JL", name: "Jérôme · Hôtel Belvédère", city: "Lyon 2e", items: "12 bains de soleil" },
  { initials: "AC", name: "Anna · Plage Privée", city: "Cannes", items: "30 tabourets" },
  { initials: "PD", name: "Paul · Brasserie Centrale", city: "Bordeaux", items: "40 chaises cannage + 10 tables" },
  { initials: "SK", name: "Sophie · Beach Club", city: "Sète", items: "8 parasols + 6 bains" },
  { initials: "TN", name: "Théo · Rooftop République", city: "Lyon 1er", items: "20 mange-debout" },
  { initials: "LV", name: "Laura · Camping 4★", city: "Royan", items: "60 chaises bistrot" },
  { initials: "EB", name: "Éric · Distrib Pro Sud", city: "Marseille", items: "Lot mixte 4 m³" },
];

const TOTAL_SLOTS = 20;
const SLOTS_TAKEN = FAKE_BUYERS.length;

function getDiscountTier(fillPct: number) {
  if (fillPct >= 100) return { pct: 12, label: "Container plein" };
  if (fillPct >= 80) return { pct: 8, label: "Seuil de départ atteint" };
  if (fillPct >= 60) return { pct: 5, label: "60 % rempli" };
  return { pct: 0, label: "Tarif de base" };
}

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function ContainerClubPage() {
  // Pre-populate with realistic dummy data (multiples of pack size)
  const [qtys, setQtys] = useState<Record<string, number>>({
    "bistrot-rotin": 60,
    "bistrot-cannage": 50,
    "tabouret-bistrot": 50,
    "table-bistrot-60": 20,
  });
  const [options, setOptions] = useState<Record<string, string | undefined>>(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.id, defaultOptionId(p)])),
  );
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(23);
  const [hours, setHours] = useState(14);
  const [mins, setMins] = useState(37);
  const [exploded, setExploded] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>("Tous");
  const [sort, setSort] = useState<SortKey>("default");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setMins((m) => {
        if (m > 0) return m - 1;
        setHours((h) => {
          if (h > 0) return h - 1;
          setDays((d) => Math.max(0, d - 1));
          return 23;
        });
        return 59;
      });
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(
    () =>
      PRODUCTS.map((p) => ({
        product: p,
        qty: qtys[p.id] ?? 0,
        color: getProductColor(p, options[p.id]),
      })),
    [qtys, options],
  );
  const usedCBM = items.reduce((s, i) => s + unitCBM(i.product) * i.qty, 0);
  const fillPct = Math.min(100, (usedCBM / CONTAINER_CBM) * 100);
  const subTotalHT = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const tier = getDiscountTier(fillPct);
  const tierDiscount = subTotalHT * (tier.pct / 100);
  const totalHT = subTotalHT - tierDiscount;
  const deposit = totalHT * 0.3;
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const retailEquivalent = items.reduce(
    (s, i) => s + i.product.retailPrice * i.qty,
    0,
  );
  const savings = retailEquivalent - totalHT;

  const setQty = (id: string, n: number) =>
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, n) }));

  const filteredProducts = useMemo(() => {
    let list = PRODUCTS.filter((p) => category === "Tous" || p.category === category);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "cbm-asc") list = [...list].sort((a, b) => unitCBM(a) - unitCBM(b));
    return list;
  }, [category, sort]);

  const detailProduct = useMemo(
    () => PRODUCTS.find((p) => p.id === detailId) ?? null,
    [detailId],
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: PRODUCTS.length };
    for (const p of PRODUCTS) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, []);

  const deliveryDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <ContainerIcon className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-semibold tracking-tight">
                Container Club
              </span>
              <span className="hidden rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
                Concept
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Container #024 · <span className="text-primary">{fillPct.toFixed(0)}% rempli</span>
            </span>
            <Button asChild size="sm">
              <a href="#reserve">
                Réserver ma place <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              Pré-commande B2B · Sourcing direct usine
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl">
              La chaise bistrot
              <br />
              <span className="italic text-primary">au prix de l'usine.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground">
              Le club d'achat groupé des pros de la terrasse parisienne.
              Tressage, textilène, plateaux : tout est configurable, en direct usine.
              Jusqu'à <span className="font-semibold text-foreground">−55 %</span> sur le prix grossiste.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="h-12 px-7 text-base">
                <a href="#reserve">
                  Configurer mon mobilier
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Acompte 30 % · remboursable jusqu'à clôture
              </div>
            </div>

            {/* Trust strip inline */}
            <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 border-t border-border pt-6 text-left sm:gap-8">
              {[
                { v: "−38 %", l: "vs. prix grossiste FR" },
                { v: "6 mois", l: "production + transport" },
                { v: "33 m³", l: "par container 20'" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-2xl text-foreground sm:text-3xl">{s.v}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive container */}
      <section
        id="reserve"
        className="mx-auto max-w-7xl scroll-mt-20 px-6 pb-20"
      >
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Container #024 — ouvert à la réservation
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Regardez votre container se remplir.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Chaque réservation occupe un volume réel dans notre prochain
            container 20 pieds. Quand il est plein, on expédie — et vous
            économisez.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* 3D + progress */}
          <div className="lg:col-span-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* Progress bar */}
              <div className="border-b border-border bg-gradient-to-b from-card to-card px-5 py-4">
                <div className="mb-2 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Remplissage
                    </div>
                    <div className="font-display text-3xl tabular-nums">
                      {fillPct.toFixed(0)}
                      <span className="text-lg text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div className="font-medium">
                      {usedCBM.toFixed(2)}{" "}
                      <span className="text-muted-foreground">/ {CONTAINER_CBM} m³</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.max(0, CONTAINER_CBM - usedCBM).toFixed(2)} m³ restants
                    </div>
                  </div>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_70%,white)]"
                    animate={{ width: `${fillPct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                  {/* Threshold tick at 80% */}
                  <div className="absolute inset-y-0 left-[80%] w-px bg-foreground/20" />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>0</span>
                  <span className="text-foreground/50">80 % seuil de départ</span>
                  <span>100 %</span>
                </div>
              </div>
              {/* 3D Canvas */}
              <div className="relative h-[420px] w-full sm:h-[540px]">
                <ContainerScene items={items} exploded={exploded} />
                <div className="absolute right-3 top-3 flex flex-col gap-1.5">
                  <Button
                    variant={exploded ? "default" : "outline"}
                    size="sm"
                    className="h-8 gap-1.5 bg-card/90 px-2.5 text-xs backdrop-blur"
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
              </div>
              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
                <span>Glisser pour pivoter · Molette pour zoomer</span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  <Anchor className="h-3 w-3" /> 20' High Cube
                </span>
              </div>
            </div>
          </div>

          {/* Catalog */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-xl">Catalogue</h3>
                  <div className="text-xs text-muted-foreground">
                    Échantillon · {PRODUCTS.length} modèles affichés sur 28 formes de chaises & fauteuils
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Sélection</div>
                  <div className="font-semibold tabular-nums">{totalUnits} unités</div>
                </div>
              </div>

              {/* Filters */}
              <div className="mb-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1">
                  {CATEGORIES.map((c) => {
                    const active = c === category;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {c}
                        <span className={`ml-1 tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>
                          {categoryCounts[c] ?? 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
                  </span>
                  <label className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3 w-3" />
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="default">Par défaut</option>
                      <option value="price-asc">Prix ↑</option>
                      <option value="price-desc">Prix ↓</option>
                      <option value="cbm-asc">Compact ↑</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {filteredProducts.map((p: Product) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    qty={qtys[p.id] ?? 0}
                    optionId={options[p.id]}
                    onChange={(n) => setQty(p.id, n)}
                    onOptionChange={(id) =>
                      setOptions((prev) => ({ ...prev, [p.id]: id }))
                    }
                    onOpenDetails={() => setDetailId(p.id)}
                  />
                ))}
                {filteredProducts.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    Aucun produit dans cette catégorie.
                  </div>
                )}
              </div>
              <div className="mt-4 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Direct usine : </span>
                choisissez la couleur du tressage, du textilène ou du plateau —
                le container 3D se met à jour en direct.
              </div>
              {/* Degressive pricing ladder */}
              <div className="mt-3 rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Remise collective
                  </div>
                  {tier.pct > 0 && (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Palier actif : −{tier.pct}%
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { t: 60, p: 5 },
                    { t: 80, p: 8 },
                    { t: 100, p: 12 },
                  ].map((step) => {
                    const reached = fillPct >= step.t;
                    return (
                      <div
                        key={step.t}
                        className={`rounded-md border px-2 py-1.5 transition-colors ${
                          reached
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wider">
                          {step.t}% rempli
                        </div>
                        <div className="font-display text-base tabular-nums">
                          −{step.p}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live status */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Le club
                </div>
                <div className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {TOTAL_SLOTS - SLOTS_TAKEN} places restantes
                </div>
              </div>
              <div className="mt-2 font-display text-3xl tabular-nums">
                {SLOTS_TAKEN}
                <span className="text-lg text-muted-foreground"> / {TOTAL_SLOTS}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                pros ont déjà réservé sur ce container
              </div>
              <div className="mt-3 space-y-1.5">
                {FAKE_BUYERS.slice(0, 4).map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs"
                    title={b.name}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-foreground/80"
                      style={{
                        backgroundColor: i % 2 ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {b.initials}
                    </div>
                    <div className="min-w-0 flex-1 truncate text-muted-foreground">
                      <span className="font-medium text-foreground">{b.city}</span>
                      <span className="mx-1 text-border">·</span>
                      {b.items}
                    </div>
                  </div>
                ))}
                <div className="pt-0.5 text-[11px] text-muted-foreground">
                  + {FAKE_BUYERS.length - 4} autres pros
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Ship className="h-3.5 w-3.5" /> Expédition
              </div>
              <div className="mt-2 font-display text-xl leading-tight">
                Au plus tôt : <span className="text-primary">container plein</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Au plus tard : <span className="font-medium text-foreground">{deliveryDate}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                Livraison France métropolitaine incluse
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Clôture des réservations
              </div>
              <div className="mt-2 flex items-baseline gap-3 font-display text-3xl tabular-nums">
                <span>
                  {days}
                  <span className="ml-0.5 text-xs text-muted-foreground">j</span>
                </span>
                <span>
                  {String(hours).padStart(2, "0")}
                  <span className="ml-0.5 text-xs text-muted-foreground">h</span>
                </span>
                <span>
                  {String(mins).padStart(2, "0")}
                  <span className="ml-0.5 text-xs text-muted-foreground">m</span>
                </span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                puis lancement en production
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reservation summary */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-accent/40 p-6 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                <TrendingDown className="h-3.5 w-3.5" /> Votre économie estimée
              </div>
              <h3 className="mt-1 font-display text-3xl tracking-tight">
                Votre réservation
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verrouillez le prix usine avec un acompte de 30 %. Le solde
                sera réglé avant expédition. Configuration sauvegardée.
              </p>
              <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
                <AnimatePresence initial={false}>
                  {items
                    .filter((i) => i.qty > 0)
                    .map(({ product, qty, color }) => {
                      const optName = findOption(product, options[product.id])?.name;
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-4 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className="h-8 w-8 shrink-0 rounded-md ring-1 ring-black/5 transition-colors"
                                style={{ backgroundColor: color }}
                              />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {product.name}
                                </div>
                                <div className="truncate text-xs text-muted-foreground tabular-nums">
                                  {qty} × {formatEUR(product.price)}
                                  {optName && (
                                    <>
                                      {" · "}
                                      <span className="text-foreground/70">{optName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-semibold tabular-nums">
                              {formatEUR(product.price * qty)}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
                {totalUnits === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Aucun article — choisissez dans le catalogue ci-dessus.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Équivalent retail FR</span>
                  <span className="text-muted-foreground line-through tabular-nums">
                    {formatEUR(retailEquivalent)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total club (HT)</span>
                  <span className="tabular-nums">{formatEUR(subTotalHT)}</span>
                </div>
                {tier.pct > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Remise palier −{tier.pct}%
                    </span>
                    <span className="tabular-nums text-primary">
                      −{formatEUR(tierDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="font-medium">Total Container Club (HT)</span>
                  <span className="font-semibold tabular-nums">
                    {formatEUR(totalHT)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-1.5 text-sm">
                  <span className="font-medium text-primary">Vous économisez</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {formatEUR(savings)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Volume occupé</span>
                  <span className="tabular-nums">{usedCBM.toFixed(2)} m³</span>
                </div>
                <div className="my-2 border-t border-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Acompte aujourd'hui</span>
                    <div className="text-[11px] text-muted-foreground">30 % du total HT</div>
                  </div>
                  <span className="font-display text-3xl tabular-nums text-primary">
                    {formatEUR(deposit)}
                  </span>
                </div>
              </div>
              <Button
                size="lg"
                className="mt-5 h-12 w-full text-base"
                disabled={totalUnits === 0}
                onClick={() => setOpen(true)}
              >
                Confirmer ma réservation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-10 w-full gap-1.5"
                disabled={totalUnits === 0}
                onClick={() =>
                  openQuotePDF({
                    lines: items.map(({ product, qty }) => ({
                      product,
                      qty,
                      optionId: options[product.id],
                    })),
                    fillPct,
                    usedCBM,
                    subTotalHT,
                    tierPct: tier.pct,
                    tierDiscount,
                    totalHT,
                    retailEquivalent,
                    savings,
                    deposit,
                    containerNumber: "#024",
                    deliveryDate,
                  })
                }
              >
                <FileText className="h-4 w-4" />
                Télécharger mon devis (PDF)
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Remboursable tant que le container n'est pas plein.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-accent/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-xs uppercase tracking-[0.18em] text-primary">
              Comment ça marche
            </div>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
              Trois étapes. Six mois. Un container.
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                step: "01",
                title: "Réservez votre place",
                body: "Acompte de 30 % pour bloquer le prix usine et la couleur choisie. Remboursable.",
              },
              {
                icon: Factory,
                step: "02",
                title: "On remplit le container",
                body: "Container plein → on lance la production en Chine. Contrôle qualité SGS inclus.",
              },
              {
                icon: Truck,
                step: "03",
                title: "Livraison en 6 mois",
                body: "Solde réglé avant expédition. Réception en France, dédouané, livré chez vous.",
              },
            ].map(({ icon: Icon, step, title, body }) => (
              <div
                key={step}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-3xl text-muted-foreground/40">
                    {step}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-10 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            CE · REACH · SGS certifiés
          </div>
          <div>
            Importé par{" "}
            <span className="font-medium text-foreground">Pros Import EURL</span>{" "}
            — Paris, France
          </div>
          <div>12+ ans d'expérience sourcing</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div>
            Container Club — Un concept par{" "}
            <span className="font-medium text-foreground">Terrassea</span>
          </div>
          <a
            href="mailto:hello@terrassea.fr"
            className="hover:text-foreground"
          >
            hello@terrassea.fr
          </a>
        </div>
      </footer>

      {/* Reservation modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Confirmer votre réservation
            </DialogTitle>
            <DialogDescription>
              Acompte :{" "}
              <span className="font-semibold text-foreground">
                {formatEUR(deposit)}
              </span>{" "}
              · Total HT :{" "}
              <span className="font-semibold text-foreground">
                {formatEUR(totalHT)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
              toast.success("Réservation enregistrée", {
                description: "Mockup — aucun envoi réel.",
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom complet</Label>
                <Input id="name" required placeholder="Marie Lambert" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Société</Label>
                <Input id="company" required placeholder="Café du Port" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email pro</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="marie@cafe.fr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="siren">SIREN</Label>
              <Input
                id="siren"
                required
                inputMode="numeric"
                placeholder="123 456 789"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full">
                Confirmer & payer l'acompte
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProductDetailDialog
        product={detailProduct}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        qty={detailProduct ? (qtys[detailProduct.id] ?? 0) : 0}
        optionId={detailProduct ? options[detailProduct.id] : undefined}
        onChange={(n) => detailProduct && setQty(detailProduct.id, n)}
        onOptionChange={(id) =>
          detailProduct &&
          setOptions((prev) => ({ ...prev, [detailProduct.id]: id }))
        }
      />
    </div>
  );
}
