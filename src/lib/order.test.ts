import { describe, expect, it } from "vitest";
import {
  calculateContainerFill,
  calculateOrder,
  calculateReservationFee,
  formatEUR,
  formatEURprecise,
  getMoqStatus,
  RESERVATION_MAX,
  RESERVATION_MIN,
  RESERVATION_RATE,
  type CartItem,
} from "./order";
import type { Product } from "./products";

function mkProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-test",
    sku: "TEST-001",
    category: "chair",
    name: "Test product",
    description: "",
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
    variants: [{ id: "v1", name: "Default", hex: "#000000", unitsCommitted: 0 }],
    ...overrides,
  };
}

function mkItem(qty: number, overrides: Partial<Product> = {}): CartItem {
  const product = mkProduct(overrides);
  return { product, variant: product.variants[0], quantity: qty };
}

describe("calculateReservationFee", () => {
  it("returns 0 for an empty cart", () => {
    expect(calculateReservationFee(0)).toBe(0);
  });

  it("applies the floor (RESERVATION_MIN) on small carts", () => {
    expect(calculateReservationFee(100)).toBe(RESERVATION_MIN);
  });

  it("applies the rate in the normal range", () => {
    const subtotal = 10_000;
    expect(calculateReservationFee(subtotal)).toBe(subtotal * RESERVATION_RATE);
  });

  it("caps at RESERVATION_MAX on large carts", () => {
    expect(calculateReservationFee(1_000_000)).toBe(RESERVATION_MAX);
  });

  it("ignores negative values", () => {
    expect(calculateReservationFee(-100)).toBe(0);
  });
});

describe("calculateOrder", () => {
  it("returns zeroed totals on empty cart", () => {
    const t = calculateOrder([]);
    expect(t.subtotalHt).toBe(0);
    expect(t.totalHt).toBe(0);
    expect(t.savings).toBe(0);
    expect(t.reservationFee).toBe(0);
  });

  it("computes subtotal and VAT correctly", () => {
    const t = calculateOrder([mkItem(10)]);
    expect(t.subtotalHt).toBe(1000);
    expect(t.vat).toBeCloseTo(200);
    expect(t.totalTtc).toBeCloseTo(1200);
  });

  it("computes 30% deposit minus reservation fee", () => {
    // subtotal = 10 000 → deposit = 3 000, fee = 300, payAt80 = 2 700
    const t = calculateOrder([mkItem(100)]);
    expect(t.subtotalHt).toBe(10_000);
    expect(t.reservationFee).toBe(300);
    expect(t.payAt80Percent).toBe(2_700);
    expect(t.payBeforeShipping).toBe(7_000);
  });

  it("computes savings vs retail reference", () => {
    const t = calculateOrder([mkItem(10)]);
    expect(t.retailReference).toBe(1500);
    expect(t.savings).toBe(500);
    expect(t.savingsPercent).toBeCloseTo((500 / 1500) * 100);
  });

  it("aggregates eco contribution per unit", () => {
    const t = calculateOrder([mkItem(10)]);
    expect(t.ecoContributionTotal).toBe(5); // 0.5 × 10
  });

  it("payNow equals reservationFee", () => {
    const t = calculateOrder([mkItem(100)]);
    expect(t.payNow).toBe(t.reservationFee);
  });

  it("clamps payAt80Percent to >= 0 when fee exceeds 30% deposit", () => {
    // subtotal = 1000 → deposit = 300, fee min = 150, payAt80 = 150
    const t = calculateOrder([mkItem(10)]);
    expect(t.payAt80Percent).toBe(150);
  });
});

describe("getMoqStatus", () => {
  it("returns reached when committed >= required", () => {
    expect(getMoqStatus(50, 50).status).toBe("reached");
    expect(getMoqStatus(55, 50).status).toBe("reached");
  });

  it("returns almost in 80-99% range", () => {
    expect(getMoqStatus(40, 50).status).toBe("almost");
    expect(getMoqStatus(49, 50).status).toBe("almost");
  });

  it("returns progressing in 50-79% range", () => {
    expect(getMoqStatus(25, 50).status).toBe("progressing");
    expect(getMoqStatus(39, 50).status).toBe("progressing");
  });

  it("returns starting below 50%", () => {
    expect(getMoqStatus(10, 50).status).toBe("starting");
    expect(getMoqStatus(0, 50).status).toBe("starting");
  });

  it("caps percent at 100 when reached", () => {
    expect(getMoqStatus(70, 50).percent).toBe(100);
  });
});

describe("calculateContainerFill", () => {
  it("returns 0% on empty cart", () => {
    const f = calculateContainerFill([], 28);
    expect(f.percent).toBe(0);
    expect(f.usedCbm).toBe(0);
    expect(f.remaining).toBe(28);
  });

  it("computes used CBM and percent", () => {
    // 10 items × 0.1 m³ = 1 m³ on a 28 m³ container
    const f = calculateContainerFill([mkItem(10)], 28);
    expect(f.usedCbm).toBeCloseTo(1);
    expect(f.percent).toBeCloseTo((1 / 28) * 100);
    expect(f.remaining).toBeCloseTo(27);
  });

  it("caps percent at 100 when overflowing", () => {
    const f = calculateContainerFill([mkItem(1000)], 28);
    expect(f.percent).toBe(100);
    expect(f.remaining).toBe(0);
  });

  it("sums CBM across heterogeneous items", () => {
    const a = mkItem(10, { cbmPerUnit: 0.1 });
    const b = mkItem(5, { cbmPerUnit: 0.5 });
    // 10*0.1 + 5*0.5 = 1 + 2.5 = 3.5
    const f = calculateContainerFill([a, b], 28);
    expect(f.usedCbm).toBeCloseTo(3.5);
  });

  it("handles a tiny container capacity", () => {
    // 10 items × 0.1 m³ = 1 m³ → fills a 1 m³ container exactly
    const f = calculateContainerFill([mkItem(10)], 1);
    expect(f.percent).toBe(100);
    expect(f.remaining).toBe(0);
  });
});

describe("formatEUR", () => {
  it("formats integer amount with euro sign", () => {
    expect(formatEUR(1000)).toMatch(/1\s?000/);
    expect(formatEUR(1000)).toContain("€");
  });

  it("rounds decimals to integer for display", () => {
    expect(formatEUR(99.7)).toMatch(/100/);
  });

  it("formats zero", () => {
    expect(formatEUR(0)).toContain("0");
  });

  it("handles large amounts", () => {
    expect(formatEUR(1_234_567)).toContain("€");
  });
});

describe("formatEURprecise", () => {
  it("keeps 2 decimal places", () => {
    expect(formatEURprecise(99.99)).toMatch(/99,99/);
  });

  it("pads zero decimals", () => {
    expect(formatEURprecise(100)).toMatch(/100,00/);
  });
});

describe("calculateOrder — edge cases", () => {
  it("aggregates correctly across multiple line items", () => {
    const a = mkItem(2, { basePriceHt: 100, retailPriceRef: 150 });
    const b = mkItem(3, { basePriceHt: 50, retailPriceRef: 80 });
    // subtotal = 200 + 150 = 350
    const t = calculateOrder([a, b]);
    expect(t.subtotalHt).toBe(350);
    expect(t.retailReference).toBe(2 * 150 + 3 * 80); // 540
    expect(t.savings).toBe(190);
  });

  it("savingsPercent stays 0 when retail reference is 0", () => {
    const t = calculateOrder([mkItem(2, { basePriceHt: 100, retailPriceRef: 0 })]);
    expect(t.savingsPercent).toBe(0);
  });

  it("deposit clamp triggers under 5000€ subtotal", () => {
    // subtotal=4000 → deposit=1200, fee=150 (clamped to min), payAt80=1050
    const t = calculateOrder([mkItem(40, { basePriceHt: 100 })]);
    expect(t.subtotalHt).toBe(4000);
    expect(t.reservationFee).toBe(150);
    expect(t.payAt80Percent).toBe(1050);
  });

  it("deposit floor at 0 when fee exceeds 30%", () => {
    // Pour subtotal = 200 → deposit 30% = 60, fee min = 150 > 60 → payAt80 = 0
    const t = calculateOrder([mkItem(2)]);
    expect(t.subtotalHt).toBe(200);
    expect(t.reservationFee).toBe(150);
    expect(t.payAt80Percent).toBe(0); // clamp à 0
  });
});

describe("constants", () => {
  it("RESERVATION_RATE is 3%", () => {
    expect(RESERVATION_RATE).toBe(0.03);
  });

  it("RESERVATION_MIN floor is 150€", () => {
    expect(RESERVATION_MIN).toBe(150);
  });

  it("RESERVATION_MAX cap is 500€", () => {
    expect(RESERVATION_MAX).toBe(500);
  });
});
