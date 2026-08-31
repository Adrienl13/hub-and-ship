import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Lock,
  Minus,
  Plus,
  RefreshCcw,
  Share2,
  ShieldCheck,
  ShoppingBasket,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { ContainerFillBar } from '@/components/ContainerFillBar'
import { DeliveryInfoBox } from '@/components/DeliveryInfoBox'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { SafeImage } from '@/components/SafeImage'
import { TieredPricingViz } from '@/components/TieredPricingViz'
import { Button } from '@/components/ui/button'
import { useCartLines } from '@/hooks/useCartLines'
import { useCatalog } from '@/hooks/useCatalog'
import { useChannel } from '@/hooks/useChannel'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { encodeCartSelection } from '@/lib/catalogue/share-cart'
import {
  calculateContainerFill,
  calculateOrder,
  formatEUR,
} from '@/lib/order'
import { channelAllowsVolumeDiscounts } from '@/lib/pricing/channel'
import { openQuotePDF } from '@/lib/quote'
import {
  getNextOrderQuantity,
  getPreviousOrderQuantity,
  getQuantityRule,
} from '@/lib/quantity'
import { buildSeoHead } from '@/lib/seo'
import { useCartStore } from '@/stores/cart.store'

// Page panier dédiée (demande Adrien 08/2026) : le panneau latéral du
// header reste l'aperçu rapide, cette page est la vue COMPLÈTE — grandes
// photos, lignes éditables, récap sticky, réassurance — sur le modèle des
// meilleurs checkouts e-commerce. La barre de commande du catalogue et le
// CartSheet y mènent.

export const Route = createFileRoute('/panier')({
  head: () => ({
    ...buildSeoHead({
      title: 'Votre panier',
      description:
        'Vérifiez votre sélection de mobilier outdoor professionnel : quantités, designs, remise volume et acompte de réservation.',
      path: '/panier',
      // Page transactionnelle : jamais indexée.
      noindex: true,
    }),
  }),
  component: PanierPage,
})

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

function PanierPage() {
  const items = useCartLines()
  const { currentContainer } = useCatalog()
  const setLineQty = useCartStore((state) => state.setLineQty)
  const preferredContainerType = useCartStore(
    (state) => state.preferredContainerType,
  )
  const { channel } = useChannel()
  const [reserveOpen, setReserveOpen] = useState(false)

  const totals = useMemo(() => calculateOrder(items), [items])
  const fill = useMemo(
    () => calculateContainerFill(items, currentContainer.capacityCbm),
    [items, currentContainer.capacityCbm],
  )
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const hasItems = items.length > 0
  const showVolumeDiscounts = hasItems && channelAllowsVolumeDiscounts(channel)

  const handlePdf = () => {
    track(AnalyticsEvent.QuotePdf, { items: items.length })
    const opened = openQuotePDF({
      items,
      totals,
      fillPercent: fill.percent,
      usedCbm: fill.usedCbm,
      capacity: fill.capacity,
      containerRef: currentContainer.reference,
      port: currentContainer.port,
      containerType:
        preferredContainerType ?? currentContainer.containerType ?? '20_hc',
    })
    if (!opened) {
      toast.error('Devis bloqué par le navigateur', {
        description:
          'Autorisez les popups pour ouvrir le devis imprimable en PDF.',
      })
    }
  }

  async function shareSelection(): Promise<void> {
    const entries = items.map((item) => ({
      productId: item.product.id,
      variantId: item.variant.id,
      qty: item.quantity,
    }))
    const url = `${window.location.origin}/catalogue?panier=${encodeCartSelection(entries)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien de votre sélection copié', { description: url })
      track(AnalyticsEvent.ShareSelection, { items: entries.length })
    } catch {
      toast.error('Copie impossible', { description: url })
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Votre commande container
            </div>
            <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
              Votre panier
              {hasItems && (
                <span className="ml-3 align-middle text-base font-normal text-muted-foreground">
                  {totalUnits} pièce{totalUnits > 1 ? 's' : ''} ·{' '}
                  {items.length} ligne{items.length > 1 ? 's' : ''}
                </span>
              )}
            </h1>
          </div>
          <Link
            to="/catalogue"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--ember)] underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Continuer mes achats
          </Link>
        </div>

        {!hasItems ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-6 py-20 text-center">
            <ShoppingBasket className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-display text-lg font-semibold">
                Votre panier est vide.
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Parcourez le catalogue, choisissez vos designs et vos
                quantités — le prix container s&apos;affiche ici.
              </p>
            </div>
            <Button asChild className="h-11 rounded-sm px-6">
              <Link to="/catalogue">
                Ouvrir le catalogue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            {/* Lignes */}
            <div className="space-y-4">
              <ul className="divide-y divide-[color:var(--sand-deep)]/70 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
                {items.map((item) => {
                  const rule = getQuantityRule(item.product)
                  return (
                    <li
                      key={`${item.product.id}:${item.variant.id}`}
                      className="flex gap-4 p-4"
                    >
                      <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white ring-1 ring-[color:var(--sand-deep)] sm:h-28 sm:w-28">
                        <SafeImage
                          src={
                            item.variant.imageUrl || item.product.mainImageUrl
                          }
                          alt={`${item.product.name} — ${item.variant.name}`}
                          className="h-full w-full"
                          imgClassName="h-full w-full object-contain"
                        />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-display text-sm font-semibold leading-tight sm:text-base">
                              {item.product.name}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Design : {item.variant.name}
                            </div>
                            <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              {formatEUR(item.product.basePriceHt)} HT /
                              unité · {rule.label}
                            </div>
                          </div>
                          <span className="shrink-0 font-display text-base font-bold tabular-nums sm:text-lg">
                            {formatEUR(
                              item.product.basePriceHt * item.quantity,
                            )}
                          </span>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Réduire la quantité de ${item.product.name}`}
                              onClick={() =>
                                setLineQty(
                                  item.product.id,
                                  item.variant.id,
                                  getPreviousOrderQuantity(
                                    item.quantity,
                                    rule,
                                  ),
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] transition-colors hover:border-foreground/40"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[52px] text-center font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`Augmenter la quantité de ${item.product.name}`}
                              onClick={() =>
                                setLineQty(
                                  item.product.id,
                                  item.variant.id,
                                  getNextOrderQuantity(item.quantity, rule),
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] transition-colors hover:border-foreground/40"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            aria-label={`Retirer ${item.product.name} du panier`}
                            onClick={() =>
                              setLineQty(item.product.id, item.variant.id, 0)
                            }
                            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-[color:var(--destructive)]/50 hover:text-[color:var(--destructive)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Retirer
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Paliers de remise : « encore X pièces pour −Y % ». */}
              {showVolumeDiscounts && <TieredPricingViz items={items} />}

              <DeliveryInfoBox compact />
            </div>

            {/* Récap sticky */}
            <aside className="space-y-3 lg:sticky lg:top-20">
              <div className="rounded-md border border-[color:var(--sand-deep)] bg-card">
                <div className="border-b border-[color:var(--sand-deep)] px-4 py-3">
                  <div className="label-eyebrow text-muted-foreground">
                    Récapitulatif
                  </div>
                </div>
                <div className="space-y-1.5 px-4 py-3 text-sm">
                  <Row
                    label={`Sous-total HT (${totalUnits} pièces)`}
                    value={formatEUR(totals.subtotalHt)}
                  />
                  {showVolumeDiscounts && totals.volumeDiscountPercent > 0 && (
                    <div className="flex items-baseline justify-between text-[color:var(--forest)]">
                      <span>
                        Remise volume −{totals.volumeDiscountPercent} %
                      </span>
                      <span className="font-medium tabular-nums">
                        −{formatEUR(totals.volumeDiscountAmount)}
                      </span>
                    </div>
                  )}
                  <Row label="Total HT" value={formatEUR(totals.totalHt)} />
                  <Row label="TVA 20 %" value={formatEUR(totals.vat)} muted />
                  <Row
                    label="Total TTC"
                    value={formatEUR(totals.totalTtc)}
                    bold
                  />
                  <div className="my-2 h-px bg-[color:var(--sand-deep)]" />
                  <Row
                    label="Frais de réservation (3 %)"
                    value={formatEUR(totals.reservationFee)}
                    hint="min 150 € / max 500 €"
                  />
                  <Row
                    label="À payer aujourd'hui"
                    value={formatEUR(totals.payNow)}
                    bold
                  />
                  <Row
                    label="Acompte à 80 % du container"
                    value={formatEUR(totals.payAt80Percent)}
                    muted
                  />
                  <Row
                    label="Solde avant expédition"
                    value={formatEUR(totals.payBeforeShipping)}
                    muted
                  />
                  {totals.savings > 0 && (
                    <div className="-mx-4 -mb-3 mt-3 rounded-b-md bg-[color:var(--forest-bg)] px-4 py-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--forest)]">
                          Économie vs prix public
                        </span>
                        <span className="font-display text-base font-bold tabular-nums text-[color:var(--forest)]">
                          −{formatEUR(totals.savings)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="label-eyebrow text-muted-foreground">
                    Container {currentContainer.reference}
                  </span>
                </div>
                <ContainerFillBar
                  percent={fill.percent}
                  usedCbm={fill.usedCbm}
                  capacity={fill.capacity}
                  thresholdPercent={currentContainer.thresholdPercent}
                />
              </div>

              <Button
                className="h-12 w-full rounded-sm bg-[color:var(--foreground)] text-base text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
                onClick={() => setReserveOpen(true)}
              >
                Confirmer ma réservation
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 rounded-sm border-[color:var(--sand-deep)] text-xs"
                  onClick={handlePdf}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Devis PDF
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-sm border-[color:var(--sand-deep)] text-xs"
                  onClick={() => void shareSelection()}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Partager
                </Button>
              </div>

              <ul className="text-foreground/75 space-y-1.5 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-[11px]">
                {[
                  {
                    Icon: RefreshCcw,
                    t: 'Remboursement 100 % si Terrassea annule',
                  },
                  { Icon: Lock, t: 'Paiement Stripe sécurisé · 3D Secure' },
                  {
                    Icon: ShieldCheck,
                    t: 'Contrôle qualité SGS indépendant avant départ',
                  },
                ].map(({ Icon, t }) => (
                  <li key={t} className="flex items-start gap-2">
                    <Icon
                      className="text-foreground/50 mt-0.5 h-3 w-3 shrink-0"
                      strokeWidth={1.5}
                    />
                    {t}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </main>

      <Footer />

      <Suspense fallback={null}>
        {reserveOpen && (
          <LazyReservationDialog
            open={reserveOpen}
            onOpenChange={setReserveOpen}
            items={items}
            totals={totals}
            container={currentContainer}
          />
        )}
      </Suspense>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  muted,
  hint,
}: {
  readonly label: string
  readonly value: string
  readonly bold?: boolean
  readonly muted?: boolean
  readonly hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? 'text-muted-foreground' : 'text-foreground/80'}>
        {label}
        {hint && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            ({hint})
          </span>
        )}
      </span>
      <span
        className={`tabular-nums ${bold ? 'font-display text-base font-semibold' : muted ? 'text-muted-foreground' : 'font-medium'}`}
      >
        {value}
      </span>
    </div>
  )
}
