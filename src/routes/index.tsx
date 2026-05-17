import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpDown, Search } from "lucide-react";

import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ValueProps } from "@/components/ValueProps";
import { HowItWorks } from "@/components/HowItWorks";
import { ComparisonTable } from "@/components/ComparisonTable";
import { ProductCard } from "@/components/ProductCard";
import { ProductRow } from "@/components/ProductRow";
import { ProductDetailDialog } from "@/components/ProductDetailDialog";
import { OrderSidebar } from "@/components/OrderSidebar";
import { DeliveryInfoBox } from "@/components/DeliveryInfoBox";
import { PastContainers } from "@/components/PastContainers";
import { FaqAccordion } from "@/components/FaqAccordion";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { MobileStickyBar } from "@/components/MobileStickyBar";
import { ReservationDialog } from "@/components/ReservationDialog";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  CURRENT_CONTAINER,
  PRODUCTS,
  type Product,
} from "@/lib/products";
import {
  calculateContainerFill,
  calculateOrder,
  type CartItem,
} from "@/lib/order";
import {
  CATEGORY_FILTERS,
  filterAndSortProducts,
  getCategoryCounts,
  getDefaultVariant,
  type CatalogueFilter,
  type SortKey,
} from "@/lib/catalogue";
import { openQuotePDF } from "@/lib/quote";
import { getQuantityRule, sanitizeOrderQuantity } from "@/lib/quantity";

export const Route = createFileRoute("/")({
  component: ContainerClubPage,
});

const MOBILE_PAGE_SIZE = 8;
const DESKTOP_PAGE_SIZE = 18;

function ContainerClubPage() {
  const isMobile = useIsMobile();
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;

  // Pré-sélection couleur par produit (1ère variante)
  const [variantByProduct, setVariantByProduct] = useState<Record<string, string>>(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.id, getDefaultVariant(p).id])),
  );
  // Quantités par produit (la quantité s'applique à la variante sélectionnée)
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({
    p1: 50,
    p3: 10,
  });

  const [filter, setFilter] = useState<CatalogueFilter>("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);

  // Construire le panier
  const items: CartItem[] = useMemo(() => {
    return PRODUCTS.flatMap((product) => {
      const qty = qtyByProduct[product.id] ?? 0;
      if (qty <= 0) return [];
      const variantId = variantByProduct[product.id] ?? getDefaultVariant(product).id;
      const variant = product.variants.find((v) => v.id === variantId) ?? getDefaultVariant(product);
      return [{ product, variant, quantity: qty }];
    });
  }, [qtyByProduct, variantByProduct]);

  const totals = useMemo(() => calculateOrder(items), [items]);
  const fill = useMemo(
    () => calculateContainerFill(items, CURRENT_CONTAINER.capacityCbm),
    [items],
  );

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  const categoryCounts = useMemo(() => getCategoryCounts(PRODUCTS), []);

  const filtered = useMemo(() => {
    return filterAndSortProducts({
      products: PRODUCTS,
      filter,
      search: deferredSearch,
      sort,
    });
  }, [deferredSearch, filter, sort]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const remainingProducts = Math.max(0, filtered.length - visibleProducts.length);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [deferredSearch, filter, pageSize, sort]);

  const detailProduct: Product | null = useMemo(
    () => PRODUCTS.find((p) => p.id === detailId) ?? null,
    [detailId],
  );

  // Handlers
  const setQty = (productId: string, n: number) =>
    setQtyByProduct((prev) => {
      const product = PRODUCTS.find((item) => item.id === productId);
      if (!product) return prev;
      return {
        ...prev,
        [productId]: sanitizeOrderQuantity(n, getQuantityRule(product)),
      };
    });
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

      <ValueProps />
      <HowItWorks />
      <ComparisonTable />

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
            <a
              href="/catalogue"
              className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              Ouvrir le catalogue complet
            </a>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Catalogue (60%) */}
            <div className="lg:col-span-7">
              <div className="mb-5 flex flex-col gap-3 border-b border-[color:var(--sand-deep)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  {CATEGORY_FILTERS.map((f) => {
                    const active = f.id === filter;
                    const count = categoryCounts[f.id];
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`min-h-11 shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                          active
                            ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative block text-xs text-muted-foreground">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher SKU, modèle, couleur..."
                      className="h-11 w-full rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground sm:h-8 sm:w-64 sm:text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="h-11 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground sm:h-8 sm:text-xs"
                    >
                      <option value="default">Tri par défaut</option>
                      <option value="price-asc">Prix croissant</option>
                      <option value="price-desc">Prix décroissant</option>
                      <option value="cbm-asc">Volume CBM</option>
                      <option value="popular">Popularité</option>
                    </select>
                  </label>
                </div>
                <div className="text-xs text-muted-foreground">
                  {filtered.length} référence{filtered.length > 1 ? "s" : ""} trouvée
                  {filtered.length > 1 ? "s" : ""} · {visibleProducts.length} affichée
                  {visibleProducts.length > 1 ? "s" : ""}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-16 text-center text-sm text-muted-foreground">
                  Aucun produit dans cette catégorie pour ce container.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleProducts.map((product) => {
                    const selectedVariantId =
                      variantByProduct[product.id] ?? getDefaultVariant(product).id;
                    const quantity = qtyByProduct[product.id] ?? 0;
                    const commonProps = {
                      product,
                      variantId: selectedVariantId,
                      qty: quantity,
                      onQtyChange: (n: number) => setQty(product.id, n),
                      onVariantChange: (id: string) => setVariant(product.id, id),
                      onOpenDetails: () => setDetailId(product.id),
                    };

                    return isMobile ? (
                      <ProductCard key={product.id} {...commonProps} />
                    ) : (
                      <ProductRow key={product.id} {...commonProps} />
                    );
                  })}
                </div>
              )}

              {remainingProducts > 0 && (
                <div className="mt-5 border-t border-[color:var(--sand-deep)] pt-5 text-center">
                  <button
                    type="button"
                    className="min-h-11 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
                    onClick={() => setVisibleCount((current) => current + pageSize)}
                  >
                    Charger {Math.min(pageSize, remainingProducts)} référence
                    {Math.min(pageSize, remainingProducts) > 1 ? "s" : ""} de plus
                  </button>
                </div>
              )}

              <div className="mt-4 text-[11px] text-muted-foreground">
                MOQ usine :{" "}
                <strong className="text-foreground/80">
                  50 unités par modèle ET par couleur
                </strong>{" "}
                pour les assises, 20 pour les tables.
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

      <DeliveryInfoBox />
      <PastContainers />
      <FaqAccordion />
      <FinalCta onReserve={() => setReserveOpen(true)} />
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
            ? variantByProduct[detailProduct.id] ?? getDefaultVariant(detailProduct).id
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
