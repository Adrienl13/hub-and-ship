import type { Product } from '@/lib/products'

// D3 — les 4 gammes deviennent des univers visuels distincts (une gamme =
// une scène, pattern Apple). La collection d'un produit se déduit du préfixe
// SKU : c'est la seule clé stable partagée entre la DB (products.sku) et les
// fichiers photo de /public/catalogue.

export type CollectionKey = 'bistrot' | 'cordage' | 'textilene' | 'pietements'

export interface CollectionInfo {
  readonly key: CollectionKey
  readonly label: string
  /** Une phrase d'univers : le lieu que la gamme habille. */
  readonly tagline: string
  readonly skuPrefix: string
  /** Packshot vedette (fichier réel de /public/catalogue). */
  readonly heroImage: string
  /** Packshots secondaires pour les compositions (bandeaux, mosaïques). */
  readonly supportImages: ReadonlyArray<string>
}

export const COLLECTIONS: ReadonlyArray<CollectionInfo> = [
  {
    key: 'bistrot',
    label: 'Bistrot',
    tagline: 'La terrasse parisienne — tressage chevrons, cadre alu bambou.',
    skuPrefix: 'BIS-',
    heroImage: '/catalogue/bistro-seating-clean/BIS-011-03.webp',
    supportImages: [
      '/catalogue/bistro-seating-clean/BIS-001-01.webp',
      '/catalogue/bistro-seating-clean/BIS-011-01.webp',
    ],
  },
  {
    key: 'cordage',
    label: 'Cordage',
    tagline: 'Le lounge rooftop — corde tressée main, coussins épais.',
    skuPrefix: 'ROP-',
    heroImage: '/catalogue/rope-series/ROP-013-01.webp',
    supportImages: [
      '/catalogue/rope-series/ROP-013-02.webp',
      '/catalogue/rope-series/ROP-013-03.webp',
    ],
  },
  {
    key: 'textilene',
    label: 'Textilène',
    tagline: 'La brasserie contemporaine — toile tendue, lignes nettes.',
    skuPrefix: 'TES-',
    heroImage: '/catalogue/teslin-series/TES-001-01.webp',
    supportImages: [
      '/catalogue/teslin-series/TES-001-02.webp',
      '/catalogue/teslin-series/TES-001-03.webp',
    ],
  },
  {
    key: 'pietements',
    label: 'Piètements',
    tagline: 'La base du métier — fonte et alu, plateaux au choix.',
    skuPrefix: 'TBA-',
    heroImage: '/catalogue/table-base-series/TBA-005-01.webp',
    supportImages: [
      '/catalogue/table-base-series/TBA-001-01.webp',
      '/catalogue/table-base-series/TBA-003-01.webp',
    ],
  },
]

const COLLECTION_BY_KEY = new Map(COLLECTIONS.map((c) => [c.key, c]))

export function getCollection(key: CollectionKey): CollectionInfo {
  const info = COLLECTION_BY_KEY.get(key)
  if (!info) throw new Error(`Unknown collection: ${key}`)
  return info
}

export function isCollectionKey(value: unknown): value is CollectionKey {
  return (
    typeof value === 'string' &&
    COLLECTION_BY_KEY.has(value as CollectionKey)
  )
}

export function collectionOf(product: Product): CollectionKey | null {
  const sku = product.sku.toLocaleUpperCase('fr-FR')
  for (const info of COLLECTIONS) {
    if (sku.startsWith(info.skuPrefix)) return info.key
  }
  return null
}

export function countByCollection(
  products: ReadonlyArray<Product>,
): Record<CollectionKey, number> {
  const counts: Record<CollectionKey, number> = {
    bistrot: 0,
    cordage: 0,
    textilene: 0,
    pietements: 0,
  }
  for (const product of products) {
    const key = collectionOf(product)
    if (key) counts[key] += 1
  }
  return counts
}
