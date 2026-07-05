import { lazy, Suspense, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Maximize2,
  Minimize2,
  FileText,
  Lock,
  ShieldCheck,
  RefreshCcw,
  Truck,
  ArrowRight,
} from 'lucide-react'
import { ContainerFillBar } from '@/components/ContainerFillBar'
import { ContainerFormatToggle } from '@/components/ContainerFormatToggle'
import { ContainerScene3DFallback } from '@/components/ContainerScene3DFallback'
import { ContainerStatusBadge } from '@/components/ContainerStatusBadge'
import { CountdownBadge } from '@/components/CountdownBadge'
import { DeliveryInfoBox } from '@/components/DeliveryInfoBox'
import { ParticipantsCount } from '@/components/ParticipantsCount'
import { SeriesProgressIndicator } from '@/components/SeriesProgressIndicator'
import { TieredPricingViz } from '@/components/TieredPricingViz'
import { Button } from '@/components/ui/button'
import { useChannel } from '@/hooks/useChannel'
import { channelAllowsVolumeDiscounts } from '@/lib/pricing/channel'
import {
  CONTAINER_USABLE_CBM,
  getRemainingCbm,
  getVolumeUpgradeDelta,
} from '@/lib/container/pricing'
import { packContainerPackages } from '@/lib/container/packing'
import { CURRENT_CONTAINER, type ContainerSummary } from '@/lib/products'
import { useCartStore } from '@/stores/cart.store'
import type { ContainerType } from '@/lib/supabase/types'

const CONTAINER_TYPE_LABEL: Record<ContainerType, string> = {
  '20_dv': "20' Dry Van",
  '20_hc': "20' High Cube",
  '40_gp': "40' General Purpose",
  '40_hc': "40' High Cube",
}
import { type CartItem, type OrderTotals, formatEUR } from '@/lib/order'
import { AnimatedNumber } from '@/components/motion-helpers'

const LazyContainerScene = lazy(() =>
  import('@/components/ContainerScene').then((module) => ({
    default: module.ContainerScene,
  })),
)

const RESERVED_SCENE_MAX_SHARE = 0.3

function getItemsCbm(items: ReadonlyArray<CartItem>): number {
  return items.reduce(
    (sum, item) => sum + item.product.cbmPerUnit * item.quantity,
    0,
  )
}

function InteractiveSceneLoading() {
  return (
    <div className="bg-[color:var(--sand)]/70 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
      <div className="shadow-paper rounded-sm border border-black/10 bg-white/90 px-3 py-2 text-[11px] font-medium text-foreground">
        Chargement de la vue 3D...
      </div>
    </div>
  )
}

function limitReservedItemsForScene({
  items,
  liveItems,
  maxCbm,
  containerType,
}: {
  readonly items: ReadonlyArray<CartItem>
  readonly liveItems: ReadonlyArray<CartItem>
  readonly maxCbm: number
  readonly containerType: ContainerType
}): CartItem[] {
  if (maxCbm <= 0) return []

  for (let scale = 1; scale >= 0; scale -= 0.1) {
    const limited: CartItem[] = []
    let remainingCbm = maxCbm * scale

    for (const item of items) {
      const unitCbm = item.product.cbmPerUnit
      if (unitCbm <= 0) continue

      const quantity = Math.min(
        item.quantity,
        Math.floor(remainingCbm / unitCbm),
      )
      if (quantity <= 0) continue

      limited.push({ ...item, quantity, reserved: true })
      remainingCbm -= quantity * unitCbm
    }

    if (
      packContainerPackages([...limited, ...liveItems], containerType)
        .overflowUnits === 0
    ) {
      return limited
    }
  }

  return []
}

export function OrderSidebar({
  items,
  reservedItems = [],
  totals,
  fillPercent,
  usedCbm,
  capacity,
  onReserve,
  onDownloadPdf,
  container = CURRENT_CONTAINER,
}: {
  items: CartItem[]
  /** Loads already booked by other pros on this container. Rendered in
   *  the 3D scene in a muted grey, ignored by the fill bar (which keeps
   *  measuring only the live visitor's cart). */
  reservedItems?: ReadonlyArray<CartItem>
  totals: OrderTotals
  fillPercent: number
  usedCbm: number
  capacity: number
  onReserve: () => void
  onDownloadPdf: () => void
  container?: ContainerSummary
}) {
  const [exploded, setExploded] = useState(false)
  const [interactiveSceneEnabled, setInteractiveSceneEnabled] = useState(false)
  const hasItems = items.length > 0
  const { channel } = useChannel()
  // Volume discounts (and loss leaders) are direct-channel only; resellers get
  // their coefficient price + RFA instead (decision #5 by extension).
  const showVolumeDiscounts = hasItems && channelAllowsVolumeDiscounts(channel)
  const preferredContainerType = useCartStore(
    (state) => state.preferredContainerType,
  )
  const setPreferredContainerType = useCartStore(
    (state) => state.setPreferredContainerType,
  )
  const activeContainerType: ContainerType =
    preferredContainerType ?? container.containerType ?? '20_hc'
  const isLargeFormat =
    activeContainerType === '40_gp' || activeContainerType === '40_hc'
  // Pre-compute the volume nudge the toggle will surface to a 20' user:
  // "your cart is half-full → a 40' would give you +X m³ to play with".
  const upgrade = isLargeFormat
    ? null
    : getVolumeUpgradeDelta(activeContainerType, '40_hc')
  const remainingCbm = getRemainingCbm(activeContainerType, usedCbm)
  // De-duplicate against the visitor's cart so they don't see *their*
  // own load doubled when the variant they're picking already had
  // earlier commitments — the cart line stays the source of truth.
  const visitorVariantIds = useMemo(
    () => new Set(items.map((it) => it.variant.id)),
    [items],
  )
  const rawSceneReserved = useMemo(
    () => reservedItems.filter((it) => !visitorVariantIds.has(it.variant.id)),
    [reservedItems, visitorVariantIds],
  )
  // The live cart must stay visually dominant. `unitsCommitted` is a
  // catalogue-level MOQ signal, not a reliable physical manifest for
  // the current container, so the 3D scene only shows a capped context
  // load instead of letting historical commitments turn the view grey.
  const sceneReserved = useMemo(
    () =>
      limitReservedItemsForScene({
        items: rawSceneReserved,
        liveItems: items,
        maxCbm: Math.min(
          Math.max(0, capacity - usedCbm),
          capacity * RESERVED_SCENE_MAX_SHARE,
        ),
        containerType: activeContainerType,
      }),
    [activeContainerType, capacity, items, rawSceneReserved, usedCbm],
  )
  const sceneItems = useMemo<CartItem[]>(
    () => [...sceneReserved, ...items],
    [items, sceneReserved],
  )
  const reservedCbm = useMemo(() => getItemsCbm(sceneReserved), [sceneReserved])
  const hasSceneItems = sceneItems.length > 0

  return (
    <div className="sticky top-20 space-y-3">
      {/* 3D scene + meta */}
      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="flex items-center justify-between border-b border-[color:var(--sand-deep)] px-4 py-2.5">
          <div>
            <div className="font-display text-sm font-semibold tracking-tight">
              {container.reference}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {container.port} · {CONTAINER_TYPE_LABEL[activeContainerType]} ·{' '}
              {capacity.toFixed(0)} m³ utiles
            </div>
            <CountdownBadge
              target={container.expectedCloseAt}
              className="border-[color:var(--ember)]/30 bg-[color:var(--ember)]/10 mt-1.5 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--ember)]"
            />
          </div>
          <Button
            variant={
              interactiveSceneEnabled && exploded ? 'default' : 'outline'
            }
            size="sm"
            className="h-7 gap-1 rounded-sm border-[color:var(--sand-deep)] px-2 text-[11px]"
            disabled={!hasSceneItems}
            onClick={() => {
              if (!interactiveSceneEnabled) {
                setInteractiveSceneEnabled(true)
                return
              }
              setExploded((v) => !v)
            }}
          >
            {!interactiveSceneEnabled ? (
              <>
                <Maximize2 className="h-3 w-3" /> Activer 3D
              </>
            ) : exploded ? (
              <>
                <Minimize2 className="h-3 w-3" /> Regrouper
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" /> Vue éclatée
              </>
            )}
          </Button>
        </div>
        <div className="relative h-[360px] w-full bg-[color:var(--sand)] md:h-[420px]">
          <ContainerScene3DFallback
            items={sceneItems}
            fillPercent={fillPercent}
            containerType={activeContainerType}
          />
          {interactiveSceneEnabled && (
            <Suspense fallback={<InteractiveSceneLoading />}>
              <LazyContainerScene
                items={sceneItems}
                exploded={exploded}
                containerType={activeContainerType}
              />
            </Suspense>
          )}
          {hasSceneItems && (
            <div className="shadow-paper absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 rounded-sm border border-black/10 bg-white/90 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur">
              {items.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm bg-[#55c7c3]"
                  />
                  Votre commande
                </span>
              )}
              {sceneReserved.length > 0 && (
                <span className="text-foreground/70 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm bg-[#b6aea3]"
                  />
                  Déjà réservé
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-3 border-t border-[color:var(--sand-deep)] p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="label-eyebrow text-muted-foreground">
              État container
            </span>
            <ContainerStatusBadge
              status={container.status}
              fillPercent={fillPercent}
              thresholdPercent={container.thresholdPercent}
            />
          </div>
          <ContainerFillBar
            percent={fillPercent}
            usedCbm={usedCbm}
            capacity={capacity}
            thresholdPercent={container.thresholdPercent}
          />
          {reservedCbm > 0.01 && (
            <div className="text-foreground/70 flex items-center justify-between gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1.5 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm bg-[#8b8278] opacity-75"
                />
                Déjà réservé par d&apos;autres pros
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {reservedCbm.toFixed(1)} m³
              </span>
            </div>
          )}
          <ContainerFormatToggle
            value={activeContainerType}
            onChange={(type) => {
              // Stop tracking the override when the user picks the
              // DB-configured default — keeps the persisted state tidy.
              setPreferredContainerType(
                type === (container.containerType ?? '20_hc') ? null : type,
              )
            }}
          />
          {/* Volume nudge: on the 20', push the distributor toward a
              40' by quoting the m³ they'd unlock; on the 40', remind
              them how much room they still have to grow the order. */}
          {usedCbm > 1 && (
            <div className="border-[color:var(--ember)]/30 bg-[color:var(--ember)]/5 text-foreground/80 rounded-sm border px-2 py-1.5 text-[11px] leading-snug">
              {isLargeFormat ? (
                <>
                  Encore{' '}
                  <strong className="text-[color:var(--ember)]">
                    {remainingCbm.toFixed(1)} m³ libres
                  </strong>{' '}
                  dans ce 40' — le coût rendu au m³ chute à mesure qu'il se
                  remplit. Tarif sur devis.
                </>
              ) : upgrade && upgrade.extraCbm > 0 ? (
                <>
                  Un 40' offrirait{' '}
                  <strong className="text-[color:var(--ember)]">
                    +{upgrade.extraCbm} m³
                  </strong>{' '}
                  de place (×
                  {(CONTAINER_USABLE_CBM['40_hc'] / capacity).toFixed(1)} le
                  volume) pour ~20 % de transport en plus. Idéal pour les
                  commandes distributeur.
                </>
              ) : null}
            </div>
          )}
          <SeriesProgressIndicator
            reached={container.seriesReached}
            total={container.totalSeries}
            required={container.minSeriesRequired}
          />
          <ParticipantsCount count={container.professionalsEngaged} />
        </div>
      </div>

      {/* Récap */}
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="border-b border-[color:var(--sand-deep)] px-4 py-3">
          <div className="label-eyebrow text-muted-foreground">
            Votre commande
          </div>
        </div>

        {hasItems ? (
          <ul className="divide-[color:var(--sand-deep)]/60 divide-y">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={`${item.product.id}:${item.variant.id}`}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.variant.imageUrl ? (
                      <img
                        src={item.variant.imageUrl}
                        alt=""
                        loading="lazy"
                        className="ring-foreground/15 h-5 w-5 shrink-0 rounded-sm object-cover ring-1"
                      />
                    ) : (
                      <span className="ring-foreground/15 h-5 w-5 shrink-0 rounded-sm bg-[color:var(--sand-soft)] ring-1" />
                    )}
                    <span className="truncate">
                      <span className="font-medium tabular-nums">
                        {item.quantity}×{' '}
                      </span>
                      {item.product.name}
                      <span className="text-muted-foreground">
                        {' '}
                        · {item.variant.name}
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatEUR(item.product.basePriceHt * item.quantity)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Sélectionnez des produits dans le catalogue pour démarrer.
          </div>
        )}

        {hasItems && (
          <motion.div
            layout
            className="space-y-1 border-t border-[color:var(--sand-deep)] px-4 py-3 text-xs"
          >
            <AnimRow label="Sous-total HT" value={totals.subtotalHt} />
            <AnimRow label="TVA 20%" value={totals.vat} muted />
            <AnimRow label="Total TTC" value={totals.totalTtc} bold />
            <div className="my-2 h-px bg-[color:var(--sand-deep)]" />
            <AnimRow
              label="Frais réservation (3%)"
              value={totals.reservationFee}
              hint="min 150€ / max 500€"
            />
            <div className="my-2 h-px bg-[color:var(--sand-deep)]" />
            <AnimRow label="À payer aujourd'hui" value={totals.payNow} bold />
            <AnimRow
              label="Acompte à 80%"
              value={totals.payAt80Percent}
              muted
            />
            <AnimRow
              label="Solde avant expédition"
              value={totals.payBeforeShipping}
              muted
            />
            {totals.savings > 0 && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="-mx-4 -mb-3 mt-3 rounded-b-md bg-[color:var(--sand)] px-4 py-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80">Économie totale</span>
                  <span className="font-display text-base font-semibold tabular-nums text-[color:var(--ember)]">
                    −
                    <AnimatedNumber
                      value={totals.savings}
                      format={(n) => formatEUR(n)}
                    />
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {showVolumeDiscounts && <TieredPricingViz items={items} />}
      <DeliveryInfoBox compact />

      {/* Actions */}
      <div className="space-y-2">
        <Button
          className="h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)] disabled:opacity-50"
          onClick={onReserve}
          disabled={!hasItems}
        >
          Confirmer ma réservation
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full rounded-sm border-[color:var(--sand-deep)] text-xs"
          onClick={onDownloadPdf}
          disabled={!hasItems}
        >
          <FileText className="h-3.5 w-3.5" />
          Télécharger le devis PDF
        </Button>
      </div>

      {/* Trust */}
      <ul className="text-foreground/75 space-y-1.5 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-[11px]">
        {[
          {
            Icon: RefreshCcw,
            t: 'Remboursement 100% si Container Club annule',
          },
          { Icon: Lock, t: 'Paiement Stripe sécurisé · 3D Secure' },
          {
            Icon: ShieldCheck,
            t: 'Contrôle qualité SGS indépendant avant départ',
          },
          { Icon: Truck, t: 'Transport post-port organisé côté client' },
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
    </div>
  )
}

function AnimRow({
  label,
  value,
  bold,
  muted,
  hint,
}: {
  label: string
  value: number
  bold?: boolean
  muted?: boolean
  hint?: string
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
        <AnimatedNumber value={value} format={(n) => formatEUR(n)} />
      </span>
    </div>
  )
}
