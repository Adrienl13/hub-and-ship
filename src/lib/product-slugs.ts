import type { Product } from '@/lib/products'

const DIACRITICS_RE = /[\u0300-\u036f]/g
const NON_WORD_RE = /[^a-z0-9]+/g

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/€/g, ' euro ')
    .replace(/&/g, ' et ')
    .replace(NON_WORD_RE, '-')
    .replace(/^-+|-+$/g, '')
}

export function productSlug(product: Product): string {
  return `${slugify(product.name)}-${slugify(product.sku)}`
}

export function productPath(product: Product): string {
  return `/catalogue/${productSlug(product)}`
}

export function findProductBySlug(
  products: ReadonlyArray<Product>,
  slug: string,
): Product | null {
  const normalized = slugify(decodeURIComponent(slug))
  return (
    products.find(
      (product) =>
        productSlug(product) === normalized ||
        slugify(product.sku) === normalized ||
        slugify(product.id) === normalized,
    ) ?? null
  )
}
