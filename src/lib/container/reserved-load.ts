// Build "phantom cart items" out of the units already committed by
// other pros on the active container. The 3D scene renders these in a
// muted grey so the live visitor sees that the container is already
// being filled — a strong "you're not alone" signal that reduces
// abandonment ("am I going to wait months for this to ship?").
//
// These items are intentionally NOT editable from the cart: they
// represent other people's existing reservations, so the visitor can
// never tweak their quantity.

import type { CartItem } from '@/lib/order'
import type { Product } from '@/lib/products'

export function buildReservedLoadItems(
  products: ReadonlyArray<Product>,
): CartItem[] {
  const items: CartItem[] = []
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.unitsCommitted <= 0) continue
      items.push({
        product,
        variant,
        quantity: variant.unitsCommitted,
        reserved: true,
      })
    }
  }
  return items
}
