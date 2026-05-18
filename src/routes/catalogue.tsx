import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Layers3, Search } from "lucide-react";
import { toast } from "sonner";

import { CatalogueLineItem } from "@/components/CatalogueLineItem";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MobileStickyBar } from "@/components/MobileStickyBar";
import { OrderSidebar } from "@/components/OrderSidebar";
import { ProductDetailDialog } from "@/components/ProductDetailDialog";
import { ReservationDialog } from "@/components/ReservationDialog";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_FILTERS,
  PAGE_SIZE_OPTIONS,
  filterAndSortProducts,
  getCategoryCounts,
  getDefaultVariant,
  type CatalogueFilter,
  type PageSizeOption,
  type SortKey,
} from "@/lib/catalogue";
import {
  formatEUR,
} from "@/lib/order";
import { openQuotePDF } from "@/lib/quote";
import { CURRENT_CONTAINER, PRODUCTS, type Product } from "@/lib/products";
import { useCart } from "@/stores/cart.store";

export const Route = createFileRoute("/catalogue")({
  component: CataloguePage,
});

function CataloguePage() {
  const {
    items,
    totals,
    fill,
    totalUnits,
    variantByProduct,
    qtyByProduct,
    setQty,
    setVariant,
  } = useCart();
  const [filter, setFilter] = useState<CatalogueFilter>("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [pageSize, setPageSize] = useState<PageSizeOption>(30);
  const [visibleCount, setVisibleCount] = useState<number>(pageSize);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reserveOpen, setReserveOpen] = useState(false);

  const categoryCounts = useMemo(() => getCategoryCounts(PRODUCTS), []);
  const filtered = useMemo(
    () =>
      filterAndSortProducts({
        products: PRODUCTS,
        filter,
        search: deferredSearch,
        sort,
      }),
    [deferredSearch, filter, sort],
  );
  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const remainingProducts = Math.max(0, filtered.length - visibleProducts.length);
  const detailProduct: Product | null = useMemo(
    () => PRODUCTS.find((product) => product.id === detailId) ?? null,
    [detailId],
  );

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [deferredSearch, filter, pageSize, sort]);

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
    <div id="top" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main>
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-3xl">
              <div className="label-eyebrow text-[color:var(--ember)]">Catalogue complet</div>
              <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
                Vue compacte pour commander vite.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                Pensée pour 100+ références : lignes denses, variantes accessibles,
                quantité directe, recherche SKU/couleur et panier toujours visible.
              </p>
            </div>
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-sm">
              <div className="label-eyebrow text-muted-foreground">Commande active</div>
              <div className="mt-2 font-display text-2xl font-semibold tabular-nums">
                {formatEUR(totals.subtotalHt)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {totalUnits} unités · {fill.percent.toFixed(0)}% container
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-9">
            <div className="sticky top-16 z-20 min-w-0 border-b border-[color:var(--sand-deep)] bg-background/95 py-4 backdrop-blur">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {CATEGORY_FILTERS.map((category) => {
                    const active = category.id === filter;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setFilter(category.id)}
                        className={`min-h-11 shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                            : "border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground/75 hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {category.label}
                        <span className={`ml-1.5 tabular-nums ${active ? "opacity-70" : "opacity-50"}`}>
                          {categoryCounts[category.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid min-w-0 gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <label className="relative block min-w-0 text-xs text-muted-foreground">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher SKU, modèle, couleur..."
                      className="h-11 w-full min-w-0 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </label>
                  <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value as SortKey)}
                      className="h-11 min-w-0 flex-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="default">Tri par défaut</option>
                      <option value="price-asc">Prix croissant</option>
                      <option value="price-desc">Prix décroissant</option>
                      <option value="cbm-asc">Volume CBM</option>
                      <option value="popular">Popularité</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers3 className="h-3 w-3" />
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value) as PageSizeOption)}
                      className="h-11 min-w-0 flex-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} / page
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="text-xs text-muted-foreground">
                  {filtered.length} référence{filtered.length > 1 ? "s" : ""} trouvée
                  {filtered.length > 1 ? "s" : ""} · {visibleProducts.length} affichée
                  {visibleProducts.length > 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
              <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[52px_minmax(160px,1.3fr)_112px_118px_70px_144px_56px] md:gap-2">
                <span />
                <span>Produit</span>
                <span>Variante</span>
                <span>MOQ</span>
                <span className="text-right">Prix HT</span>
                <span>Quantité</span>
                <span />
              </div>

              {filtered.length === 0 ? (
                <div className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Aucun produit ne correspond à ces filtres.
                </div>
              ) : (
                visibleProducts.map((product) => {
                  const selectedVariantId =
                    variantByProduct[product.id] ?? getDefaultVariant(product).id;
                  return (
                    <CatalogueLineItem
                      key={product.id}
                      product={product}
                      variantId={selectedVariantId}
                      qty={qtyByProduct[product.id] ?? 0}
                      onQtyChange={(quantity) => setQty(product.id, quantity)}
                      onVariantChange={(variantId) => setVariant(product.id, variantId)}
                      onOpenDetails={() => setDetailId(product.id)}
                    />
                  );
                })
              )}
            </div>

            {remainingProducts > 0 && (
              <div className="mt-5 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-sm border-[color:var(--sand-deep)]"
                  onClick={() => setVisibleCount((current) => current + pageSize)}
                >
                  Charger {Math.min(pageSize, remainingProducts)} référence
                  {Math.min(pageSize, remainingProducts) > 1 ? "s" : ""} de plus
                </Button>
              </div>
            )}
          </div>

          <aside className="lg:col-span-3">
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
        </section>
      </main>

      <Footer />

      <MobileStickyBar
        totalItems={totalUnits}
        fillPercent={fill.percent}
        subtotalHt={totals.subtotalHt}
        onReserve={() => setReserveOpen(true)}
      />

      <ProductDetailDialog
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(value) => !value && setDetailId(null)}
        qty={detailProduct ? qtyByProduct[detailProduct.id] ?? 0 : 0}
        variantId={
          detailProduct
            ? variantByProduct[detailProduct.id] ?? getDefaultVariant(detailProduct).id
            : ""
        }
        onQtyChange={(quantity) => detailProduct && setQty(detailProduct.id, quantity)}
        onVariantChange={(variantId) => detailProduct && setVariant(detailProduct.id, variantId)}
      />

      <ReservationDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        items={items}
        totals={totals}
      />
    </div>
  );
}
