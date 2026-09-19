// Surface minimale de data.js pour TypeScript — l'adaptateur reste en JS
// vanilla comme le reste de public-design ; seuls les champs lus par les
// tests et les appelants typés sont déclarés.

/** Fiche telle que la lit le tiroir du catalogue. */
export interface AdaptedProduct {
  readonly id: string
  readonly ref: string
  readonly name: string
  readonly shortName: string
  readonly cat: string
  readonly category: string
  readonly kind: string
  readonly material: string
  /** « 48 × 56 × 86 cm », « Ensemble 4 pièces », ou « À préciser ». */
  readonly dimensions: string
  /** « 4.3 kg » ou « À préciser » — jamais « 0 kg ». */
  readonly weight: string
  readonly frame: string
  readonly price: number | null
  readonly moq: number | null
  readonly img: string
  readonly gallery: ReadonlyArray<string>
  readonly variants: ReadonlyArray<ReadonlyArray<string>>
  readonly [key: string]: unknown
}

export const minimum: (p: AdaptedProduct, i: number) => number | null
export function adaptCatalogue(data: unknown): AdaptedProduct[]
export function sanitizeCart(
  input: unknown,
  products: ReadonlyArray<AdaptedProduct>,
  identities?: unknown,
): unknown
export function estimate(
  cart: unknown,
  products: ReadonlyArray<AdaptedProduct>,
): unknown
