import { describe, expect, it } from "vitest";

import {
  getNextOrderQuantity,
  getPreviousOrderQuantity,
  getQuantityRule,
  sanitizeOrderQuantity,
} from "@/lib/quantity";
import { PRODUCTS } from "@/lib/products";

const chair = PRODUCTS.find((product) => product.category === "chair")!;
const table = PRODUCTS.find((product) => product.category === "table")!;

describe("quantity rules", () => {
  it("requires a minimum of 50 units for chairs", () => {
    const rule = getQuantityRule(chair);

    expect(sanitizeOrderQuantity(0, rule)).toBe(0);
    expect(sanitizeOrderQuantity(1, rule)).toBe(50);
    expect(sanitizeOrderQuantity(49, rule)).toBe(50);
    expect(sanitizeOrderQuantity(50, rule)).toBe(50);
  });

  it("rounds chair quantities up to the next pack of 10 after 50", () => {
    const rule = getQuantityRule(chair);

    expect(sanitizeOrderQuantity(51, rule)).toBe(60);
    expect(sanitizeOrderQuantity(59, rule)).toBe(60);
    expect(sanitizeOrderQuantity(60, rule)).toBe(60);
    expect(sanitizeOrderQuantity(61, rule)).toBe(70);
  });

  it("increments and decrements chairs by the business pack size", () => {
    const rule = getQuantityRule(chair);

    expect(getNextOrderQuantity(0, rule)).toBe(50);
    expect(getNextOrderQuantity(50, rule)).toBe(60);
    expect(getPreviousOrderQuantity(60, rule)).toBe(50);
    expect(getPreviousOrderQuantity(50, rule)).toBe(0);
  });

  it("keeps non-chair products editable by unit", () => {
    const rule = getQuantityRule(table);

    expect(sanitizeOrderQuantity(1, rule)).toBe(1);
    expect(getNextOrderQuantity(1, rule)).toBe(2);
    expect(getPreviousOrderQuantity(2, rule)).toBe(1);
  });
});
