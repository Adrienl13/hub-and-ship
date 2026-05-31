import { lazy, Suspense, useState } from 'react'
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
import { DeliveryInfoBox } from '@/components/DeliveryInfoBox'
import { ParticipantsCount } from '@/components/ParticipantsCount'
import { SeriesProgressIndicator } from '@/components/SeriesProgressIndicator'
import { TieredPricingViz } from '@/components/TieredPricingViz'
import { Button } from '@/components/ui/button'
import {
  getCostPerCbm,
  getTransportDelta,
} from '@/lib/container/pricing'
import { CURRENT_CONTAINER, type ContainerSummary } from '@/lib/products'
import { useCartStore } from '@/stores/cart.store'
import type { ContainerType } from '@/lib/supabase/types'

const CONTAINER_TYPE_LABEL: Record<ContainerType, string> = {
  '20_dv': "20' Dry Van · 33 m³",
  '20_hc': "20' High Cube · 37 m³",
  '40_gp': "40' General Purpose · 68 m³",
  '40_hc': "40' High Cube · 76 m³",
}
import { type CartItem, type OrderTotals, formatEUR } from '@/lib/order'
import { AnimatedNumber } from '@/components/motion-helpers'

const LazyContainerScene = lazy(() =>
  import('@/components/ContainerScene').then((module) => ({
    default: module.ContainerScene,
  })),
)

export function OrderSidebar({
  items,
  totals,
  fillPercent,
  usedCbm,
  capacity,
  onReserve,
  onDownloadPdf,
  container = CURRENT_CONTAINER,
}: {
  items: CartItem[]
  totals: OrderTotals
  fillPercent: number
  usedCbm: number
  capacity: number
  onReserve: () => void
  onDownloadPdf: () => void
  container?: ContainerSummary
}) {
  const [exploded, setExploded] = useState(false)
  const hasItems = items.length > 0
  const preferredContainerType = useCartStore(
    (state) => state.preferredContainerType,
  )
  const setPreferredContainerType = useCartStore(
    (state) => state.setPreferredContainerType,
  )
  const activeContainerType: ContainerType =
    preferredContainerType ?? container.containerType ?? '20_hc'
  const ratePerCbm = Math.round(getCostPerCbm(activeContainerType))
  // Cross-format saving when used cbm is significant enough to matter.
  // Always compare against the other "natural" option:
  //   - on a 20', show how much going 40' would save (or cost)
  //   - on a 40', show what staying on 20' would have cost (positive
  //     value = user is saving money by being on 40')
  const alternativeType: ContainerType =
    activeContainerType === '40_gp' || activeContainerType === '40_hc'
      ? '20_hc'
      : '40_gp'
  const transportDelta = getTransportDelta(
    alternativeType,
    activeContainerType,
    usedCbm,
  )

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
              {container.port} ·{' '}
              {CONTAINER_TYPE_LABEL[activeContainerType]} · {ratePerCbm} €/m³
            </div>
          </div>
          <Button
            variant={exploded ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1 rounded-sm border-[color:var(--sand-deep)] px-2 text-[11px]"
            onClick={() => setExploded((v) => !v)}
          >
            {exploded ? (
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
          <ContainerScene3DFallback items={items} fillPercent={fillPercent} />
          <Suspense fallback={null}>
            <LazyContainerScene
              items={items}
              exploded={exploded}
              containerType={activeContainerType}
            />
          </Suspense>
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
          {usedCbm > 1 && (
            <div
              className={`rounded-sm border px-2 py-1.5 text-[11px] leading-snug ${
                transportDelta > 0
                  ? 'border-[color:var(--forest)]/30 bg-[color:var(--forest)]/5 text-[color:var(--forest)]'
                  : transportDelta < 0
                    ? 'border-[color:var(--ember)]/30 bg-[color:var(--ember)]/5 text-[color:var(--ember)]'
                    : 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground/70'
              }`}
            >
              {transportDelta > 0 ? (
                <>
                  <strong>{transportDelta.toLocaleString('fr-FR')} €</strong> de
                  transport économisés sur ces {usedCbm.toFixed(1)} m³ vs un{' '}
                  {alternativeType === '40_gp' ? "40' GP" : "20' HC"}.
                </>
              ) : transportDelta < 0 ? (
                <>
                  Vous payez{' '}
                  <strong>
                    {Math.abs(transportDelta).toLocaleString('fr-FR')} €
                  </strong>{' '}
                  de plus qu'avec un{' '}
                  {alternativeType === '40_gp' ? "40' GP" : "20' HC"}. Switchez
                  si vous comptez ajouter du volume.
                </>
              ) : (
                <>Choisissez le format pour comparer le coût rendu.</>
              )}
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

      {hasItems && <TieredPricingViz items={items} />}
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
