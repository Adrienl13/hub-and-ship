// Déclarations minimales de model.js pour les tests TypeScript.
export interface HomeCardSource {
  ref: string
  name: string
  shortName?: string
  cat: string
  kind: string
  img: string
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

export function liveHomeCards(
  products: ReadonlyArray<HomeCardSource>,
  tab: string,
): HomeCard[]

export class Accueil {
  liveProducts: HomeCardSource[] | null
  renderVals(): Record<string, unknown>
}
