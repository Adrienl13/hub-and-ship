// Déclarations minimales de model.js pour les tests TypeScript.
export interface HomeCardSource {
  ref: string
  name: string
  shortName?: string
  cat: string
  kind: string
  img: string
  gallery?: string[]
}

export interface HomeCard {
  name: string
  kind: string
  img: string
  href: string
}

export function splitDisplayName(
  shortName: string,
  fallbackKind?: string,
): { title: string; kind: string }

export const HOME_PICKS: Record<string, string[]>

export function liveHomeCards(
  products: ReadonlyArray<HomeCardSource>,
  tab: string,
  picks?: Record<string, string[]>,
): HomeCard[]

export interface BandCard {
  name: string
  img?: string | null
  href: string
}

export function liveBandCards(
  bandDefs: ReadonlyArray<BandCard>,
  products: ReadonlyArray<HomeCardSource>,
): BandCard[]

export class Accueil {
  liveProducts: HomeCardSource[] | null
  renderVals(): Record<string, unknown>
}
