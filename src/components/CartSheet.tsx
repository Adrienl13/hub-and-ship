import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Minus, Plus, ShoppingBasket, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { getDefaultVariant } from '@/lib/catalogue'
import { resolveCatalogueProduct } from '@/lib/catalogue/registry'
import { calculateOrder, formatEUR, type CartItem } from '@/lib/order'
import {
  getNextOrderQuantity,
  getPreviousOrderQuantity,
  getQuantityRule,
} from '@/lib/quantity'
import { useCartStore } from '@/stores/cart.store'

// « Ma commande » — panneau latéral accessible depuis le header sur TOUTES
// les pages : chaque ligne est modifiable (quantité par pas métier,
// suppression), le total suit. Les produits sont résolus via le registre du
// catalogue live — la même source d'identité que le panier lui-même.

function useSheetItems(): CartItem[] {
  const qtyByProduct = useCartStore((state) => state.qtyByProduct)
  const variantByProduct = useCartStore((state) => state.variantByProduct)

  return useMemo(() => {
    const items: CartItem[] = []
    for (const [productId, quantity] of Object.entries(qtyByProduct)) {
      if (!quantity || quantity <= 0) continue
      const product = resolveCatalogueProduct(productId)
      if (!product) continue
      const variantId = variantByProduct[productId]
      const variant =
        product.variants.find((v) => v.id === variantId) ??
        getDefaultVariant(product)
      items.push({ product, variant, quantity })
    }
    return items
  }, [qtyByProduct, variantByProduct])
}

export function CartSheet() {
  const items = useSheetItems()
  const setQty = useCartStore((state) => state.setQty)
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const totals = useMemo(() => calculateOrder(items), [items])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Ma commande — ${totalUnits} unités`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[color:var(--border-strong)] bg-white transition-colors hover:border-foreground/40"
        >
          <ShoppingBasket className="h-[18px] w-[18px] text-foreground" />
          {totalUnits > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--ember)] px-1 text-[10px] font-bold tabular-nums text-white">
              {totalUnits > 999 ? '999+' : totalUnits}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col bg-background sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-lg font-extrabold">
            Ma commande
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <ShoppingBasket className="h-8 w-8 text-[color:var(--muted)]" />
            <p className="max-w-[240px] text-sm text-muted-foreground">
              Votre commande est vide. Parcourez le catalogue et ajoutez vos
              quantités.
            </p>
            <Button asChild className="rounded-[9px]">
              <Link to="/catalogue">Ouvrir le catalogue</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1 py-2">
              {items.map((item) => {
                const rule = getQuantityRule(item.product)
                return (
                  <li
                    key={`${item.product.id}:${item.variant.id}`}
                    className="flex gap-3 rounded-xl border border-[color:var(--sand-deep)] bg-white p-3"
                  >
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[color:var(--sand-soft)]">
                      <img
                        src={item.variant.imageUrl || item.product.mainImageUrl}
                        alt=""
                        className="max-h-full w-auto object-contain"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">
                        {item.product.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.variant.name} ·{' '}
                        {formatEUR(item.product.basePriceHt)} HT / u.
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Réduire la quantité"
                            onClick={() =>
                              setQty(
                                item.product.id,
                                getPreviousOrderQuantity(item.quantity, rule),
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--sand-deep)] hover:border-foreground/40"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[42px] text-center text-sm font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Augmenter la quantité"
                            onClick={() =>
                              setQty(
                                item.product.id,
                                getNextOrderQuantity(item.quantity, rule),
                              )
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--sand-deep)] hover:border-foreground/40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold tabular-nums">
                            {formatEUR(item.product.basePriceHt * item.quantity)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Retirer ${item.product.name}`}
                            onClick={() => setQty(item.product.id, 0)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--sand-deep)] text-[color:var(--destructive)] hover:bg-[color:var(--sand-soft)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="space-y-2 border-t border-[color:var(--sand-deep)] pt-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  Sous-total HT ({totalUnits} unités)
                </span>
                <span className="font-extrabold tabular-nums">
                  {formatEUR(totals.subtotalHt)}
                </span>
              </div>
              {totals.volumeDiscountPercent > 0 && (
                <div className="flex items-baseline justify-between text-xs text-[color:var(--forest)]">
                  <span>
                    Remise volume −{totals.volumeDiscountPercent}% appliquée
                  </span>
                  <span className="font-bold tabular-nums">
                    −{formatEUR(totals.volumeDiscountAmount)}
                  </span>
                </div>
              )}
              <Button
                asChild
                className="h-11 w-full rounded-[9px] text-sm font-bold"
              >
                <Link to="/catalogue">Finaliser ma réservation</Link>
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Vérification finale, devis PDF et paiement sécurisé au
                catalogue.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
