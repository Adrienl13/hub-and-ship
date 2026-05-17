import { beforeEach, describe, expect, it } from "vitest";

import { createCartSnapshot, useCartStore } from "@/stores/cart.store";

describe("cart store", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.getState().resetCart();
  });

  it("starts from the catalogue demo cart", () => {
    const { qtyByProduct, variantByProduct } = useCartStore.getState();
    const snapshot = createCartSnapshot({ qtyByProduct, variantByProduct });

    expect(qtyByProduct.p1).toBe(50);
    expect(qtyByProduct.p3).toBe(10);
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.totalUnits).toBe(60);
  });

  it("normalizes chair quantities through the shared business rule", () => {
    useCartStore.getState().setQty("p1", 51);

    expect(useCartStore.getState().qtyByProduct.p1).toBe(60);
  });

  it("keeps table quantities editable by unit", () => {
    useCartStore.getState().setQty("p3", 11);

    expect(useCartStore.getState().qtyByProduct.p3).toBe(11);
  });

  it("updates variants without changing quantities", () => {
    useCartStore.getState().setVariant("p1", "v1c");
    const state = useCartStore.getState();

    expect(state.variantByProduct.p1).toBe("v1c");
    expect(state.qtyByProduct.p1).toBe(50);
  });

  it("persists cart selections for full page navigation", () => {
    useCartStore.getState().setQty("p1", 60);

    const persisted = JSON.parse(localStorage.getItem("container-club-cart") ?? "{}");

    expect(persisted.state.qtyByProduct.p1).toBe(60);
  });
});
