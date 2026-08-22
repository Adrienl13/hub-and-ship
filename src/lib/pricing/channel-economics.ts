// Économie interne des canaux — module ADMIN uniquement.
//
// Les taux de marge markup-on-cost permettent de déduire le coût d'achat
// (landed) à partir d'un prix public : ils ne doivent JAMAIS être importés
// par une surface publique (le scan anti-fuite de scripts/check-bundle-budget
// vérifie le bundle client après build). Le miroir public des prix par canal
// vit dans ./channel.ts et n'expose que les coefficients finaux.

/**
 * Default markup-on-cost margins — mirror of the ACTIVE `pricing_parameters`
 * row (direct_margin_rate / reseller_margin_rate / distributor_margin_rate).
 * The server RPC derives its coefficients from the live row; these values are
 * the admin-side display mirror and the seed defaults.
 */
export const CHANNEL_MARGIN_RATES = {
  direct: 0.9,
  revendeur: 0.4,
  distributeur: 0.28,
} as const

/**
 * Coefficient applied to the public direct price for a given channel margin:
 * (1 + channel margin) / (1 + direct margin), rounded to 4 decimals — the
 * exact formula used by `get_catalogue_prices()`.
 */
export function channelCoefficientFromMargins(
  directMarginRate: number,
  channelMarginRate: number,
): number {
  return (
    Math.round(((1 + channelMarginRate) / (1 + directMarginRate)) * 10_000) /
    10_000
  )
}
