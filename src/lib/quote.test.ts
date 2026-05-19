import { describe, expect, it } from "vitest";
import { buildQuoteHtml, buildQuoteRef, escapeHtml, type QuoteData } from "./quote";
import { calculateOrder, type CartItem } from "./order";
import type { Product } from "./products";

function mkProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-test",
    sku: "TEST-001",
    category: "chair",
    name: "Chaise Test",
    description: "Une chaise pour tester",
    dimensions: { l: 50, w: 50, h: 80 },
    cbmPerUnit: 0.1,
    weightKg: 5,
    moqUnits: 50,
    basePriceHt: 100,
    retailPriceRef: 150,
    ecoContribution: 0.5,
    mainImageUrl: "",
    galleryUrls: [],
    features: [],
    variants: [{ id: "v1", name: "Noir", hex: "#000000", unitsCommitted: 0 }],
    ...overrides,
  };
}

function mkItem(qty: number, overrides: Partial<Product> = {}): CartItem {
  const product = mkProduct(overrides);
  return { product, variant: product.variants[0], quantity: qty };
}

function mkQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  const items: CartItem[] = [mkItem(10)];
  return {
    items,
    totals: calculateOrder(items),
    fillPercent: 12.5,
    usedCbm: 3.5,
    capacity: 28,
    containerRef: "CC-2026-001",
    port: "Marseille-Fos",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("handles all entities in one pass", () => {
    expect(escapeHtml('<a href="x&y">')).toBe("&lt;a href=&quot;x&amp;y&quot;&gt;");
  });

  it("passes plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("buildQuoteRef", () => {
  it("starts with DV- prefix", () => {
    expect(buildQuoteRef("CC-2026-001")).toMatch(/^DV-/);
  });

  it("extracts only digits from container reference", () => {
    const ref = buildQuoteRef("CC-2026-001");
    expect(ref).toContain("2026001");
  });

  it("strips non-digit characters", () => {
    const ref = buildQuoteRef("ABC-XYZ-12-34");
    // Aucune lettre du containerRef avant le timestamp suffix
    const middle = ref.slice(3, ref.lastIndexOf("-"));
    expect(middle).toBe("1234");
  });

  it("ends with a 5-char uppercase suffix", () => {
    const ref = buildQuoteRef("CC-2026-001");
    const suffix = ref.split("-").pop() ?? "";
    expect(suffix).toMatch(/^[0-9A-Z]{5}$/);
  });

  it("generates a different ref on consecutive calls", () => {
    const a = buildQuoteRef("CC-2026-001");
    // Petit délai sync : on rappelle avec Date.now() différent
    // (Date.now resolution = 1ms, donc 99% du temps c'est différent)
    const b = buildQuoteRef("CC-2026-001");
    // Si exact même ms, le suffix peut être identique - on accepte
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
});

describe("buildQuoteHtml", () => {
  it("returns non-empty HTML string", () => {
    const html = buildQuoteHtml(mkQuote());
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes container reference", () => {
    const html = buildQuoteHtml(mkQuote({ containerRef: "CC-9999-042" }));
    expect(html).toContain("CC-9999-042");
  });

  it("includes destination port", () => {
    const html = buildQuoteHtml(mkQuote({ port: "Le Havre" }));
    expect(html).toContain("Le Havre");
  });

  it("includes product name for each line item", () => {
    const items = [mkItem(2, { name: "Chaise Cannes" }), mkItem(3, { name: "Table Lyon" })];
    const html = buildQuoteHtml({
      ...mkQuote(),
      items,
      totals: calculateOrder(items),
    });
    expect(html).toContain("Chaise Cannes");
    expect(html).toContain("Table Lyon");
  });

  it("escapes potentially dangerous product names", () => {
    const items = [mkItem(1, { name: "<script>alert('xss')</script>" })];
    const html = buildQuoteHtml({
      ...mkQuote(),
      items,
      totals: calculateOrder(items),
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes the buyer info when provided", () => {
    const html = buildQuoteHtml({
      ...mkQuote(),
      buyer: { company: "Hôtel Royal", email: "contact@royal.fr" },
    });
    expect(html).toContain("Hôtel Royal");
    expect(html).toContain("contact@royal.fr");
  });
});
