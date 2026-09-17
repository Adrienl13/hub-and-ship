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
  // Le MOQ est affiché sur la carte, la fiche et le devis : il doit être tenu,
  // quelle que soit la catégorie. Il ne l'était que pour les assises — 42
  // fiches actives (lounge, piètements, bancs, plateaux) annonçaient un
  // minimum de 5 à 70 unités tout en se laissant ajouter à 1. Un devis partait
  // alors sous le minimum de série, à reprendre au téléphone.
  const minimum = Math.max(
    product.moqUnits > 0 ? product.moqUnits : 1,
    colorMinimum,
    1,
  )

  // Assises (chaises ET fauteuils) : la commande démarre au minimum de série
  // du produit, puis progresse par packs de 10 — la même logique s'applique
  // à toutes les cartes (règle métier, demande client 07/2026). Le pas de 10
  // reste PROPRE aux assises : ailleurs on complète à l'unité.
  if (product.category === 'chair' || product.category === 'armchair') {
    return {
      minimum,
      step: 10,
      label: `Min. ${minimum} puis +10`,
    }
  }

  if (minimum <= 1) return DEFAULT_QUANTITY_RULE

  // Un coloris à minimum imposé (ex. plateau d'une teinte spéciale) prime sur
  // le minimum de série quand il est plus haut : on nomme alors la vraie
  // contrainte, sinon l'acheteur ne comprend pas d'où sort le chiffre.
  return {
    minimum,
    step: 1,
    label:
      colorMinimum > product.moqUnits
        ? `Min. ${minimum} pour ce coloris, puis à l'unité`
        : `Min. ${minimum} puis à l'unité`,
  }
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
