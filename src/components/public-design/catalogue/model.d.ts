// Déclaration minimale du modèle JavaScript du catalogue, pour les tests en
// TypeScript. Le modèle est volontairement souple (vue-modèle assemblée à
// la main) : on ne décrit ici que ce que les tests touchent.
import type { AdaptedProduct } from './data.js'

export class CatalogueModel {
  state: Record<string, unknown> & {
    sheet: string | null
    qty: number
    quoteStatus: string
  }
  products: AdaptedProduct[]
  setState(change: unknown): void
  minimum(p: AdaptedProduct, i: number): number
  isStocked(p: AdaptedProduct, i: number): boolean
  sheetQuantity(p: AdaptedProduct, i: number, n: number): number
  eur(n: number): string
  totalLabel(rows: unknown, n: number): string
  deliverQuote(payload: Record<string, unknown>): Promise<void>
  submitQuote(event: unknown, p: AdaptedProduct, vi: number): Promise<void>
  quoteVals(p: AdaptedProduct | null, vi: number): Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderVals(): any
}
