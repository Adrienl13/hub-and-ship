// Stable, human-readable product URLs: /catalogue/p/<name-slug>-<sku>.
// The SKU suffix is the identity (unique, immutable); the name part is
// cosmetic, so a renamed product keeps resolving via its SKU.

import type { Product } from '@/lib/products'

export function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export function productSlug(product: Pick<Product, 'name' | 'sku'>): string {
  const name = slugifyProductName(product.name)
  const sku = product.sku.toLowerCase()
  return name ? `${name}-${sku}` : sku
}

export function productPath(product: Pick<Product, 'name' | 'sku'>): string {
  return `/catalogue/p/${productSlug(product)}`
}

/**
 * Resolves a product from a URL slug. Exact slug match first, then SKU-suffix
 * match so old links keep working after a product rename.
 */
export function findProductBySlug<T extends Pick<Product, 'name' | 'sku'>>(
  products: ReadonlyArray<T>,
  slug: string,
): T | null {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null

  const exact = products.find((p) => productSlug(p) === normalized)
  if (exact) return exact

  return (
    products.find((p) => {
      const sku = p.sku.toLowerCase()
      return normalized === sku || normalized.endsWith(`-${sku}`)
    }) ?? null
  )
}
