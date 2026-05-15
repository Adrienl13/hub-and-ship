import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpDown } from "lucide-react";

import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { ProductRow } from "@/components/ProductRow";
import { ProductDetailDialog } from "@/components/ProductDetailDialog";
import { OrderSidebar } from "@/components/OrderSidebar";
import { PastContainers } from "@/components/PastContainers";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Footer } from "@/components/Footer";
import { MobileStickyBar } from "@/components/MobileStickyBar";
import { ReservationDialog } from "@/components/ReservationDialog";

import {
  CATEGORY_LABEL,
  CURRENT_CONTAINER,
  PRODUCTS,
  type Product,
  type ProductCategory,
} from "@/lib/products";
import {
  calculateContainerFill,
  calculateOrder,
  type CartItem,
} from "@/lib/order";
import { openQuotePDF } from "@/lib/quote";

export const Route = createFileRoute("/")({
  component: ContainerClubPage,
});

const CATEGORY_FILTERS: Array<{ id: "all" | ProductCategory; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "chair", label: "Chaise" },
  { id: "armchair", label: "Fauteuil" },
  { id: "table", label: "Table" },
  { id: "bench", label: "Banc" },
];

type SortKey = "default" | "price-asc" | "price-desc" | "cbm-asc" | "popular";

function ContainerClubPage() {
  // Pré-sélection couleur par produit (1ère variante)
  const [variantByProduct, setVariantByProduct] = useState<Record<string, string>>(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.id, p.variants[0].id])),
  );
  // Quantités par produit (la quantité s'applique à la variante sélectionnée)
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({
    p1: 24,
    p3: 10,
  });

  const [filter, setFilter] = useState<"all" | ProductCategory>("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);

  // Construire le panier
  const items: CartItem[] = useMemo(() => {
    return PRODUCTS.flatMap((product) => {
      const qty = qtyByProduct[product.id] ?? 0;
      if (qty <= 0) return [];
      const variantId = variantByProduct[product.id] ?? product.variants[0].id;
      const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
      return [{ product, variant, quantity: qty }];
    });
  }, [qtyByProduct, variantByProduct]);

  const totals = useMemo(() => calculateOrder(items), [items]);
  const fill = useMemo(
    () => calculateContainerFill(items, CURRENT_CONTAINER.capacityCbm),
    [items],
  );

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  // Filtrage + tri
  const filtered = useMemo(() => {
    let list = PRODUCTS.filter((p) => filter === "all" || p.category === filter);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.basePriceHt - b.basePriceHt);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.basePriceHt - a.basePriceHt);
    else if (sort === "cbm-asc") list = [...list].sort((a, b) => a.cbmPerUnit - b.cbmPerUnit);
    else if (sort === "popular")
      list = [...list].sort(
        (a, b) =>
          b.variants.reduce((s, v) => s + v.unitsCommitted, 0) -
          a.variants.reduce((s, v) => s + v.unitsCommitted, 0),
      );
    return list;
  }, [filter, sort]);

  const detailProduct: Product | null = useMemo(
    () => PRODUCTS.find((p) => p.id === detailId) ?? null,
    [detailId],
  );

  // Handlers
  const setQty = (productId: string, n: number) =>
    setQtyByProduct((prev) => ({ ...prev, [productId]: Math.max(0, n) }));
  const setVariant = (productId: string, variantId: string) =>
    setVariantByProduct((prev) => ({ ...prev, [productId]: variantId }));

  const handleEmail = () => {
    toast.success("Devis envoyé", {
      description: "Vous recevrez votre devis PDF par email sous 2 minutes.",
    });
  };

  const handlePdf = () => {
    openQuotePDF({
      items,
      totals,
      fillPercent: fill.percent,
      usedCbm: fill.usedCbm,
      capacity: fill.capacity,
      containerRef: CURRENT_CONTAINER.reference,
      port: CURRENT_CONTAINER.port,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <Hero
        fillPercent={fill.percent}
        seriesReached={CURRENT_CONTAINER.seriesReached}
        totalSeries={CURRENT_CONTAINER.totalSeries}
        professionalsEngaged={CURRENT_CONTAINER.professionalsEngaged}
      />

      <HowItWorks />

      {/* Catalogue */}
      <section
        id="catalogue"
        className="border-t border-[color:var(--sand-deep)] scroll-mt-20"
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="label-eyebrow text-[color:var(--ember)]">Catalogue</div>
              <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                Choisissez vos modèles, couleur par couleur.
              </h2>
              <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
                Chaque référence affiche son MOQ en temps réel : ajoutez votre
                quantité pour faire grimper la barre et déclencher la série.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Catalogue (60%) */}
            <div className="lg:col-span-7">
              {/* Filtres */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--sand-deep)] pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_FILTERS.map((f) => {
                    const active = f.id === filter;
                    const count =
                      f.id === "all"
                        ? PRODUCTS.length
                        : PRODUCTS.filter((p) => p.category === f.id).length;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-foreground text-background"
                            : "border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground/75 hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {f.label}
                        <span className={`ml-1.5 tabular-nums ${active ? "opacity-70" : "opacity-50"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowUpDown className="h-3 w-3" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="default">Tri par défaut</option>
                    <option value="price-asc">Prix croissant</option>
                    <option value="price-desc">Prix décroissant</option>
                    <option value="cbm-asc">Volume CBM</option>
                    <option value="popular">Popularité</option>
                  </select>
                </label>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-16 text-center text-sm text-muted-foreground">
                  Aucun produit dans cette catégorie pour ce container.
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      variantId={
                        variantByProduct[product.id] ?? product.variants[0].id
                      }
                      qty={qtyByProduct[product.id] ?? 0}
                      onQtyChange={(n) => setQty(product.id, n)}
                      onVariantChange={(id) => setVariant(product.id, id)}
                      onOpenDetails={() => setDetailId(product.id)}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 text-[11px] text-muted-foreground">
                {CATEGORY_LABEL.chair && (
                  <>
                    MOQ usine :{" "}
                    <strong className="text-foreground/80">
                      50 unités par modèle ET par couleur
                    </strong>{" "}
                    pour les assises, 20 pour les tables.
                  </>
                )}
              </div>
            </div>

            {/* Sidebar (40%) */}
            <aside className="lg:col-span-5">
              <OrderSidebar
                items={items}
                totals={totals}
                fillPercent={fill.percent}
                usedCbm={fill.usedCbm}
                capacity={fill.capacity}
                onReserve={() => setReserveOpen(true)}
                onDownloadPdf={handlePdf}
                onEmailQuote={handleEmail}
              />
            </aside>
          </div>
        </div>
      </section>

      <PastContainers />
      <FaqAccordion />
      <Footer />

      <MobileStickyBar
        totalItems={totalUnits}
        fillPercent={fill.percent}
        subtotalHt={totals.subtotalHt}
        onReserve={() => setReserveOpen(true)}
      />

      {/* Modals */}
      <ProductDetailDialog
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(v) => !v && setDetailId(null)}
        qty={detailProduct ? qtyByProduct[detailProduct.id] ?? 0 : 0}
        variantId={
          detailProduct
            ? variantByProduct[detailProduct.id] ?? detailProduct.variants[0].id
            : ""
        }
        onQtyChange={(n) => detailProduct && setQty(detailProduct.id, n)}
        onVariantChange={(id) => detailProduct && setVariant(detailProduct.id, id)}
      />

      <ReservationDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        totals={totals}
      />
    </div>
  );
}
