import type { Product } from "@/lib/products";

export interface QuantityRule {
  minimum: number;
  step: number;
  label: string;
}

export const DEFAULT_QUANTITY_RULE: QuantityRule = {
  minimum: 1,
  step: 1,
  label: "Ajout à l'unité",
};

export function getQuantityRule(product: Product): QuantityRule {
  if (product.category === "chair") {
    return {
      minimum: 50,
      step: 10,
      label: "Min. 50 puis +10",
    };
  }

  return DEFAULT_QUANTITY_RULE;
}

export function sanitizeOrderQuantity(quantity: number, rule: QuantityRule): number {
  if (!Number.isFinite(quantity)) return 0;

  const integerQuantity = Math.max(0, Math.trunc(quantity));
  if (integerQuantity === 0) return 0;
  if (integerQuantity <= rule.minimum) return rule.minimum;

  const stepsAboveMinimum = Math.ceil((integerQuantity - rule.minimum) / rule.step);
  return rule.minimum + stepsAboveMinimum * rule.step;
}

export function getNextOrderQuantity(currentQuantity: number, rule: QuantityRule): number {
  const current = sanitizeOrderQuantity(currentQuantity, rule);
  if (current === 0) return rule.minimum;
  return current + rule.step;
}

export function getPreviousOrderQuantity(currentQuantity: number, rule: QuantityRule): number {
  const current = sanitizeOrderQuantity(currentQuantity, rule);
  if (current <= rule.minimum) return 0;
  return Math.max(rule.minimum, current - rule.step);
}
