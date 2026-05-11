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
} from "lucide-react";

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
import { CONTAINER_CBM, PRODUCTS, type Product } from "@/lib/products";

export const Route = createFileRoute("/")({
  component: ContainerClubPage,
});

const FAKE_BUYERS = ["MR", "JL", "AC", "PD", "SK", "EB", "TN", "LV"];

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function ContainerClubPage() {
  // Pre-populate with realistic dummy data so user immediately sees value
  const [qtys, setQtys] = useState<Record<string, number>>({
    chaise: 24,
    table: 6,
    parasol: 4,
    bain: 2,
    tabouret: 0,
    banquette: 0,
  });
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(23);
  const [hours, setHours] = useState(14);
  const [mins, setMins] = useState(37);

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
    () => PRODUCTS.map((p) => ({ product: p, qty: qtys[p.id] ?? 0 })),
    [qtys],
  );
  const usedCBM = items.reduce((s, i) => s + i.product.cbm * i.qty, 0);
  const fillPct = Math.min(100, (usedCBM / CONTAINER_CBM) * 100);
  const totalHT = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const deposit = totalHT / 2;
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);

  const setQty = (id: string, n: number) =>
    setQtys((prev) => ({ ...prev, [id]: n }));

  const deliveryDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Ship className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Container Club
            </span>
            <span className="ml-2 hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              Concept
            </span>
          </div>
          <a
            href="#reserve"
            className="hidden items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground sm:flex"
          >
            Reserve a spot <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-20 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            B2B pre-order · Factory-direct from China
          </div>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Pro outdoor furniture,
            <br />
            <span className="text-primary">factory-direct pricing.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Reserve your spot in our next shared container. Save 30–40%.
            Delivered in 6 months.
          </p>
          <div className="mt-9 flex justify-center">
            <Button size="lg" asChild className="h-12 px-7 text-base">
              <a href="#reserve">
                Reserve your spot
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Interactive container */}
      <section
        id="reserve"
        className="mx-auto max-w-7xl scroll-mt-20 px-6 pb-20"
      >
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-primary">
              Container #024 — open
            </div>
            <h2 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
              Watch your container fill up.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Every reservation books real volume in our next 20ft container.
            When it's full, we ship — and you save.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* 3D + progress */}
          <div className="lg:col-span-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* Progress bar */}
              <div className="border-b border-border px-5 py-4">
                <div className="mb-2 flex items-end justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Container fill
                    </div>
                    <div className="font-display text-2xl tabular-nums">
                      {fillPct.toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground tabular-nums">
                    {usedCBM.toFixed(2)} / {CONTAINER_CBM} CBM
                    <div className="text-xs">
                      {(CONTAINER_CBM - usedCBM).toFixed(2)} CBM remaining
                    </div>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${fillPct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>
              {/* 3D Canvas */}
              <div className="h-[420px] w-full sm:h-[520px]">
                <ContainerScene items={items} />
              </div>
              <div className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
                Drag to rotate · Scroll to zoom
              </div>
            </div>
          </div>

          {/* Catalog */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl">Catalog</h3>
                <span className="text-xs text-muted-foreground">
                  {totalUnits} units selected
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {PRODUCTS.map((p: Product) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    qty={qtys[p.id] ?? 0}
                    onChange={(n) => setQty(p.id, n)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live status */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-semibold tabular-nums">8 buyers</div>
                <div className="text-sm text-muted-foreground">
                  have already reserved in this container
                </div>
                <div className="mt-3 flex -space-x-2">
                  {FAKE_BUYERS.map((b, i) => (
                    <div
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-semibold text-secondary-foreground"
                      style={{
                        zIndex: FAKE_BUYERS.length - i,
                        backgroundColor: i % 2 ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Ship className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-sm uppercase tracking-wider text-muted-foreground">
                  Ships when
                </div>
                <div className="mt-1 text-base font-medium">
                  100% full or by{" "}
                  <span className="text-primary">{deliveryDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-sm uppercase tracking-wider text-muted-foreground">
                  Time left to join
                </div>
                <div className="mt-1 flex items-baseline gap-3 font-display text-2xl tabular-nums">
                  <span>{days}<span className="ml-0.5 text-xs text-muted-foreground">d</span></span>
                  <span>{hours}<span className="ml-0.5 text-xs text-muted-foreground">h</span></span>
                  <span>{mins}<span className="ml-0.5 text-xs text-muted-foreground">m</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reservation summary */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-accent/30 p-6 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h3 className="font-display text-2xl tracking-tight">
                Your reservation
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Lock in factory pricing with a 50% deposit. Pay the rest before shipping.
              </p>
              <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
                <AnimatePresence initial={false}>
                  {items
                    .filter((i) => i.qty > 0)
                    .map(({ product, qty }) => (
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
                              className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/5"
                              style={{ backgroundColor: product.swatch }}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {product.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {qty} × {formatEUR(product.price)} ·{" "}
                                {(product.cbm * qty).toFixed(2)} CBM
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-semibold tabular-nums">
                            {formatEUR(product.price * qty)}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
                {totalUnits === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No items yet — pick from the catalog above.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total (excl. tax)</span>
                  <span className="font-semibold tabular-nums">
                    {formatEUR(totalHT)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Volume</span>
                  <span className="tabular-nums">{usedCBM.toFixed(2)} CBM</span>
                </div>
                <div className="my-2 border-t border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Deposit (50%)</span>
                  <span className="font-display text-2xl tabular-nums text-primary">
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
                Confirm my reservation
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Refundable until container is full.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-accent/20">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps. Six months. One full container.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                step: "01",
                title: "Reserve your spot",
                body: "Pay a 50% deposit to lock in factory pricing. No hidden fees.",
              },
              {
                icon: Factory,
                step: "02",
                title: "We fill the container",
                body: "Once full, we order from our verified Chinese factory and handle quality control.",
              },
              {
                icon: Truck,
                step: "03",
                title: "Delivery in 6 months",
                body: "Pay the remaining 50% before shipping. Receive in your country, customs-cleared.",
              },
            ].map(({ icon: Icon, step, title, body }) => (
              <div
                key={step}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-2xl text-muted-foreground">
                    {step}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
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
            CE · REACH · SGS certified
          </div>
          <div>
            Imported by{" "}
            <span className="font-medium text-foreground">
              Pros Import EURL
            </span>{" "}
            — Paris, France
          </div>
          <div>12+ years sourcing experience</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div>
            Container Club — A concept by{" "}
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
              Confirm your reservation
            </DialogTitle>
            <DialogDescription>
              Deposit:{" "}
              <span className="font-semibold text-foreground">
                {formatEUR(deposit)}
              </span>{" "}
              · Total:{" "}
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
              toast.success("Reservation recorded", {
                description: "This is a mockup — no real submission.",
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required placeholder="Marie Lambert" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" required placeholder="Café du Port" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
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
                Confirm reservation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
