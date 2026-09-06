import type { DesignVariant, Product } from '@/lib/products'

export interface QuantityRule {
  minimum: number
  step: number
  label: string
}

export const DEFAULT_QUANTITY_RULE: QuantityRule = {
  minimum: 1,
  step: 1,
  label: "Ajout à l'unité",
}

/** Minimum de commande propre au coloris (plateaux de teinte spéciale). */
export function variantMinimum(
  variant: Pick<DesignVariant, 'minOrderUnits'> | null | undefined,
): number {
  const value = variant?.minOrderUnits
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0
}

export function getQuantityRule(
  product: Product,
  variant?: Pick<DesignVariant, 'minOrderUnits'> | null,
): QuantityRule {
  const colorMinimum = variantMinimum(variant)

  // Assises (chaises ET fauteuils) : la commande démarre au minimum de série
  // du produit, puis progresse par packs de 10 — la même logique s'applique
  // à toutes les cartes (règle métier, demande client 07/2026).
  if (product.category === 'chair' || product.category === 'armchair') {
    const minimum = Math.max(product.moqUnits, colorMinimum)
    return {
      minimum,
      step: 10,
      label: `Min. ${minimum} puis +10`,
    }
  }

  // Un coloris à minimum imposé (ex. plateau d'une teinte spéciale) démarre
  // à ce minimum puis s'ajoute à l'unité.
  if (colorMinimum > 0) {
    return {
      minimum: colorMinimum,
      step: 1,
      label: `Min. ${colorMinimum} pour ce coloris, puis à l'unité`,
    }
  }

  return DEFAULT_QUANTITY_RULE
}

export function sanitizeOrderQuantity(
  quantity: number,
  rule: QuantityRule,
): number {
  if (!Number.isFinite(quantity)) return 0

  const integerQuantity = Math.max(0, Math.trunc(quantity))
  if (integerQuantity === 0) return 0
  if (integerQuantity <= rule.minimum) return rule.minimum

  const stepsAboveMinimum = Math.ceil(
    (integerQuantity - rule.minimum) / rule.step,
  )
  return rule.minimum + stepsAboveMinimum * rule.step
}

export function getNextOrderQuantity(
  currentQuantity: number,
  rule: QuantityRule,
): number {
  const current = sanitizeOrderQuantity(currentQuantity, rule)
  if (current === 0) return rule.minimum
  return current + rule.step
}

export function getPreviousOrderQuantity(
  currentQuantity: number,
  rule: QuantityRule,
): number {
  const current = sanitizeOrderQuantity(currentQuantity, rule)
  if (current <= rule.minimum) return 0
  return Math.max(rule.minimum, current - rule.step)
}
