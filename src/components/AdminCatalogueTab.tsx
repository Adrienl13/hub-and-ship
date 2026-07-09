import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Calculator,
  Download,
  History,
  ImageOff,
  PackagePlus,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import { AdminProductEditor } from '@/components/AdminProductEditor'
import { AdminStockEditor } from '@/components/AdminStockEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BISTRO_PRODUCTS } from '@/lib/bistro-products'
import { ROPE_PRODUCTS } from '@/lib/rope-products'
import { TABLE_BASE_PRODUCTS } from '@/lib/table-base-products'
import { TESLIN_PRODUCTS } from '@/lib/teslin-products'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import {
  applyPriceAdjustment,
  applyReprice,
  checkPricingControl,
  getActivePricingParameters,
  listAdminContainers,
  listPricingParameterVersions,
  listProducts,
  previewPriceAdjustment,
  previewReprice,
  reactivateProduct,
  savePricingParametersVersion,
  softDeleteProduct,
  updatePricingParameters,
  upsertProduct,
  upsertVariant,
  type CatalogueAdminClient,
  type PriceAdjustmentRow,
  type PriceAdjustmentScope,
  type PricingControlStatus,
  type RepriceRow,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminContainerOption,
  AdminPricingParameters,
  AdminProduct,
} from '@/lib/catalogue-admin/types'
import { useAuth } from '@/hooks/useAuth'
import { computeProductProfit } from '@/lib/pricing/product-profit'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCatalogStore } from '@/stores/catalog.store'
import type { AuthStatus } from '@/hooks/useAuth'

export interface AdminCatalogueTabProps {
  readonly authStatus: AuthStatus
}

type AdminCategoryFilter = 'all' | Product['category']
type AdminCollectionFilter =
  | 'all'
  | 'bistro'
  | 'rope'
  | 'teslin'
  | 'table-base'
  | 'other'
type AdminStatusFilter = 'all' | 'active' | 'inactive'

const CATEGORY_FILTERS: ReadonlyArray<{
  readonly id: AdminCategoryFilter
  readonly label: string
}> = [
  { id: 'all', label: 'Tous types' },
  { id: 'chair', label: 'Chaises' },
  { id: 'armchair', label: 'Fauteuils' },
  { id: 'table', label: 'Tables' },
  { id: 'bench', label: 'Bancs' },
]

const COLLECTION_FILTERS: ReadonlyArray<{
  readonly id: AdminCollectionFilter
  readonly label: string
}> = [
  { id: 'all', label: 'Toutes collections' },
  { id: 'bistro', label: 'Bistrot' },
  { id: 'rope', label: 'Cordage' },
  { id: 'teslin', label: 'Textilène' },
  { id: 'table-base', label: 'Piètements' },
  { id: 'other', label: 'Autres' },
]

const STATUS_FILTERS: ReadonlyArray<{
  readonly id: AdminStatusFilter
  readonly label: string
}> = [
  { id: 'all', label: 'Tous états' },
  { id: 'active', label: 'Actifs' },
  { id: 'inactive', label: 'Désactivés' },
]

function getProductCollection(product: Pick<AdminProduct, 'sku' | 'id'>) {
  const key = `${product.sku} ${product.id}`.toLowerCase()
  if (key.includes('bis-') || key.includes('bistro')) return 'bistro'
  if (key.includes('rop-') || key.includes('rope')) return 'rope'
  if (key.includes('tes-') || key.includes('teslin')) return 'teslin'
  if (key.includes('tba-') || key.includes('table-base')) return 'table-base'
  return 'other'
}

function countByFilter<T extends string>(
  rows: ReadonlyArray<AdminProduct>,
  filters: ReadonlyArray<{ readonly id: T }>,
  getValue: (row: AdminProduct) => T,
): Record<T, number> {
  const counts = Object.fromEntries(filters.map(({ id }) => [id, 0])) as Record<
    T,
    number
  >
  for (const row of rows) {
    counts[getValue(row)] = (counts[getValue(row)] ?? 0) + 1
  }
  return counts
}

type PricingParameterPayload = Parameters<typeof updatePricingParameters>[2]

function percentToRate(value: string): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed / 100 : 0
}

function numberFromInput(value: string): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function intFromInput(value: string): number {
  return Math.max(1, Math.round(numberFromInput(value)))
}

function PricingParametersPanel({
  parameters,
  saving,
  onSave,
}: {
  readonly parameters: AdminPricingParameters
  readonly saving: boolean
  readonly onSave: (payload: PricingParameterPayload) => void
}) {
  const [freight, setFreight] = useState(String(parameters.freightEur40hc))
  const [fx, setFx] = useState(String(parameters.fxUsdEur))
  const [customsPercent, setCustomsPercent] = useState(
    String(parameters.customsRate * 100),
  )
  const [insurancePercent, setInsurancePercent] = useState(
    String(parameters.importInsuranceRate * 100),
  )
  const [fixedFee, setFixedFee] = useState(String(parameters.fixedImportFeeEur))
  const [directMarginPercent, setDirectMarginPercent] = useState(
    String(parameters.directMarginRate * 100),
  )
  const [resellerMarginPercent, setResellerMarginPercent] = useState(
    String(parameters.resellerMarginRate * 100),
  )
  const [distributorMarginPercent, setDistributorMarginPercent] = useState(
    String(parameters.distributorMarginRate * 100),
  )
  const [tier2Qty, setTier2Qty] = useState(String(parameters.tier2Qty))
  const [tier2DiscountPercent, setTier2DiscountPercent] = useState(
    String(parameters.tier2Discount * 100),
  )
  const [tier3Qty, setTier3Qty] = useState(String(parameters.tier3Qty))
  const [tier3DiscountPercent, setTier3DiscountPercent] = useState(
    String(parameters.tier3Discount * 100),
  )

  useEffect(() => {
    setFreight(String(parameters.freightEur40hc))
    setFx(String(parameters.fxUsdEur))
    setCustomsPercent(String(parameters.customsRate * 100))
    setInsurancePercent(String(parameters.importInsuranceRate * 100))
    setFixedFee(String(parameters.fixedImportFeeEur))
    setDirectMarginPercent(String(parameters.directMarginRate * 100))
    setResellerMarginPercent(String(parameters.resellerMarginRate * 100))
    setDistributorMarginPercent(String(parameters.distributorMarginRate * 100))
    setTier2Qty(String(parameters.tier2Qty))
    setTier2DiscountPercent(String(parameters.tier2Discount * 100))
    setTier3Qty(String(parameters.tier3Qty))
    setTier3DiscountPercent(String(parameters.tier3Discount * 100))
  }, [parameters])

  const freightValue = numberFromInput(freight)
  const freightDelta =
    parameters.freightEur40hc > 0
      ? ((freightValue - parameters.freightEur40hc) /
          parameters.freightEur40hc) *
        100
      : 0
  const hasFreightChange = Math.abs(freightDelta) >= 0.01

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const nextTier2Qty = intFromInput(tier2Qty)
    const nextTier3Qty = Math.max(nextTier2Qty + 1, intFromInput(tier3Qty))

    onSave({
      fx_usd_eur: Math.max(0.0001, numberFromInput(fx)),
      freight_eur_40hc: Math.max(0, numberFromInput(freight)),
      customs_rate: Math.max(0, percentToRate(customsPercent)),
      import_insurance_rate: Math.max(0, percentToRate(insurancePercent)),
      fixed_import_fee_eur: Math.max(0, numberFromInput(fixedFee)),
      direct_margin_rate: Math.max(0, percentToRate(directMarginPercent)),
      reseller_margin_rate: Math.max(0, percentToRate(resellerMarginPercent)),
      distributor_margin_rate: Math.max(
        0,
        percentToRate(distributorMarginPercent),
      ),
      tier2_qty: nextTier2Qty,
      tier2_discount: Math.max(0, percentToRate(tier2DiscountPercent)),
      tier3_qty: nextTier3Qty,
      tier3_discount: Math.max(0, percentToRate(tier3DiscountPercent)),
    })
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Paramètres pricing
          </div>
          <div className="mt-1 text-sm font-medium">
            Version {parameters.version} · {parameters.label}
          </div>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer paramètres'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PricingInput
          label="Fret 40HC (€)"
          value={freight}
          onChange={setFreight}
          step="1"
        />
        <PricingInput label="Taux USD → EUR" value={fx} onChange={setFx} />
        <PricingInput
          label="Douane (%)"
          value={customsPercent}
          onChange={setCustomsPercent}
        />
        <PricingInput
          label="Assurance import (%)"
          value={insurancePercent}
          onChange={setInsurancePercent}
        />
        <PricingInput
          label="Frais fixes / unité (€)"
          value={fixedFee}
          onChange={setFixedFee}
        />
        <PricingInput
          label="Marge directe (%)"
          value={directMarginPercent}
          onChange={setDirectMarginPercent}
        />
        <PricingInput
          label="Marge revendeur (%)"
          value={resellerMarginPercent}
          onChange={setResellerMarginPercent}
        />
        <PricingInput
          label="Marge distributeur (%)"
          value={distributorMarginPercent}
          onChange={setDistributorMarginPercent}
        />
        <PricingInput
          label="Palier 2 quantité"
          value={tier2Qty}
          onChange={setTier2Qty}
          step="1"
        />
        <PricingInput
          label="Palier 2 remise (%)"
          value={tier2DiscountPercent}
          onChange={setTier2DiscountPercent}
        />
        <PricingInput
          label="Palier 3 quantité"
          value={tier3Qty}
          onChange={setTier3Qty}
          step="1"
        />
        <PricingInput
          label="Palier 3 remise (%)"
          value={tier3DiscountPercent}
          onChange={setTier3DiscountPercent}
        />
      </div>

      <div
        className={`rounded-sm border px-3 py-2 text-xs ${
          hasFreightChange
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-muted-foreground'
        }`}
      >
        Variation fret vs valeur active :{' '}
        <span className="font-medium">
          {hasFreightChange ? `${freightDelta.toFixed(2)}%` : '0%'}
        </span>
        . Ce paramètre impacte tous les prix calculés par `get_price` dès que
        les produits ont un FOB USD et une quantité réelle / 40HC.
      </div>
    </form>
  )
}

function PricingInput({
  label,
  value,
  onChange,
  step = '0.01',
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly step?: string
}) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-sm border border-[color:var(--sand-deep)] bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
      />
    </label>
  )
}

const EUR_PRECISE = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

const EUR_ROUND = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

// Bénéfice estimé au prix public actuel (base − coût rendu), avec la
// projection sur un container plein. « — » tant que les coûts FOB manquent.
function ProductProfitCell({
  row,
  parameters,
}: {
  readonly row: AdminProduct
  readonly parameters: AdminPricingParameters | null
}) {
  const profit = parameters
    ? computeProductProfit(
        row.basePriceHt,
        row.fobUsd,
        row.qtyPerContainer,
        parameters,
      )
    : null

  if (!profit) {
    return (
      <span className="text-xs text-muted-foreground md:text-right">—</span>
    )
  }

  const tone =
    profit.unitProfitHt > 0 && !profit.belowFloor
      ? 'text-[color:var(--forest)]'
      : 'text-red-700'
  const sign = profit.unitProfitHt > 0 ? '+' : ''
  return (
    <span className="md:text-right" title="Bénéfice HT estimé au prix direct actuel (hors frais de vente)">
      <span className={`font-medium tabular-nums ${tone}`}>
        {sign}
        {profit.unitProfitHt.toFixed(2)} €
      </span>
      <span className="block text-[10px] text-muted-foreground tabular-nums">
        {profit.marginPercent.toFixed(0)} % ·{' '}
        {EUR_ROUND.format(profit.containerProfitHt)}/40HC
        {profit.belowFloor ? ' · sous plancher' : ''}
      </span>
    </span>
  )
}

// P0.3 — bandeau du SKU témoin : vert quand le prix moteur recalculé colle
// aux valeurs tamponnées à la dernière sauvegarde, rouge quand la formule ou
// les données ont dérivé sans décision admin.
function PricingControlBanner({
  status,
}: {
  readonly status: PricingControlStatus
}) {
  if (!status.computable || status.driftPercent === null) {
    return (
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-xs text-muted-foreground">
        Témoin {status.controlSku} : prix moteur non calculable (produit ou
        coûts FOB manquants). Le garde-fou de dérive est inactif.
      </div>
    )
  }

  const drifted = Math.abs(status.driftPercent) >= 0.5
  if (!drifted) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[color:var(--forest)]/35 bg-[color:var(--forest)]/8 px-3 py-2 text-xs text-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[color:var(--forest)]" />
        <span>
          Formule conforme — témoin {status.controlSku} :{' '}
          {status.actualDirectHt === null
            ? '—'
            : EUR_PRECISE.format(status.actualDirectHt)}{' '}
          direct HT (attendu{' '}
          {status.expectedDirectHt === null
            ? '—'
            : EUR_PRECISE.format(status.expectedDirectHt)}
          ).
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span>
        Dérive détectée sur le témoin {status.controlSku} :{' '}
        {status.driftPercent > 0 ? '+' : ''}
        {status.driftPercent.toFixed(2)}% (
        {status.actualDirectHt === null
          ? '—'
          : EUR_PRECISE.format(status.actualDirectHt)}{' '}
        calculé vs{' '}
        {status.expectedDirectHt === null
          ? '—'
          : EUR_PRECISE.format(status.expectedDirectHt)}{' '}
        attendu). Vérifiez paramètres et coûts avant tout recalcul.
      </span>
    </div>
  )
}

// P0.1 — recalcul explicite : dry-run (diff produit par produit) puis
// application en un clic. Rien ne bouge tant que l'admin n'applique pas.
function RepricePanel({
  rows,
  previewing,
  applying,
  lastApplied,
  onPreview,
  onApply,
  onClose,
}: {
  readonly rows: ReadonlyArray<RepriceRow> | null
  readonly previewing: boolean
  readonly applying: boolean
  readonly lastApplied: number | null
  readonly onPreview: () => void
  readonly onApply: () => void
  readonly onClose: () => void
}) {
  const priced = (rows ?? []).filter(
    (row): row is RepriceRow & { enginePriceHt: number } =>
      row.enginePriceHt !== null,
  )
  const changed = priced.filter(
    (row) => Math.abs(row.enginePriceHt - row.currentPriceHt) > 0.005,
  )
  const withoutCosts = (rows ?? []).filter((row) => !row.hasCosts)
  const atFloor = priced.filter((row) => row.atMarginFloor)
  const averageDelta =
    changed.length > 0
      ? changed.reduce((sum, row) => sum + (row.deltaPercent ?? 0), 0) /
        changed.length
      : 0

  return (
    <div className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Recalcul des prix
          </div>
          <div className="mt-1 text-sm font-medium">
            Moteur → base_price_ht (canal direct, qté 1)
          </div>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            L&apos;aperçu compare le prix public actuel au prix théorique du
            moteur (FOB + fret + douane + marge). Rien n&apos;est modifié tant
            que vous n&apos;appliquez pas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-sm"
            disabled={previewing || applying}
            onClick={onPreview}
          >
            <Calculator className="h-3.5 w-3.5" />
            {previewing ? 'Calcul en cours…' : 'Prévisualiser le recalcul'}
          </Button>
          {rows !== null && (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-sm"
              disabled={applying || changed.length === 0}
              onClick={onApply}
            >
              {applying
                ? 'Application…'
                : `Appliquer (${changed.length} prix)`}
            </Button>
          )}
        </div>
      </div>

      {lastApplied !== null && (
        <div className="rounded-sm border border-[color:var(--forest)]/35 bg-[color:var(--forest)]/8 px-3 py-2 text-xs">
          Recalcul appliqué : {lastApplied} prix mis à jour.
        </div>
      )}

      {rows !== null && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-sm bg-[color:var(--sand-soft)] px-2 py-1">
              {priced.length} produits avec coûts
            </span>
            <span className="rounded-sm bg-[color:var(--sand-soft)] px-2 py-1">
              {changed.length} prix qui changeraient · Δ moyen{' '}
              {averageDelta > 0 ? '+' : ''}
              {averageDelta.toFixed(2)}%
            </span>
            <span
              className={`rounded-sm px-2 py-1 ${
                atFloor.length > 0
                  ? 'bg-amber-50 text-amber-950'
                  : 'bg-[color:var(--sand-soft)]'
              }`}
            >
              {atFloor.length} au plancher de marge
            </span>
            <span className="rounded-sm bg-[color:var(--sand-soft)] px-2 py-1">
              {withoutCosts.length} sans coûts (inchangés)
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm px-2 py-1 text-muted-foreground underline-offset-2 hover:underline"
            >
              Fermer l&apos;aperçu
            </button>
          </div>

          {changed.length === 0 ? (
            <div className="rounded-sm bg-[color:var(--sand-soft)] px-3 py-2 text-xs text-muted-foreground">
              Aucun écart entre les prix actuels et le moteur : rien à
              appliquer.
            </div>
          ) : (
            <div className="max-h-72 overflow-auto rounded-sm border border-[color:var(--sand-deep)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[color:var(--sand-soft)] text-left">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">SKU</th>
                    <th className="px-2 py-1.5 font-medium">Produit</th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Actuel HT
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Moteur HT
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {changed.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-t border-[color:var(--sand-deep)]"
                    >
                      <td className="px-2 py-1.5 font-mono">{row.sku}</td>
                      <td className="max-w-52 truncate px-2 py-1.5">
                        {row.name}
                        {row.atMarginFloor && (
                          <span className="ml-1.5 rounded-sm bg-amber-100 px-1 py-0.5 text-[10px] text-amber-950">
                            plancher
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {EUR_PRECISE.format(row.currentPriceHt)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {EUR_PRECISE.format(row.enginePriceHt)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          (row.deltaPercent ?? 0) > 0
                            ? 'text-red-700'
                            : 'text-[color:var(--forest)]'
                        }`}
                      >
                        {(row.deltaPercent ?? 0) > 0 ? '+' : ''}
                        {(row.deltaPercent ?? 0).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Ajustement ciblé : ±X % sur une catégorie et/ou une collection, sans
// toucher au reste du catalogue. Même philosophie que le recalcul : aperçu
// produit par produit, puis application explicite.
const ADJUST_CATEGORY_OPTIONS: ReadonlyArray<{
  readonly id: string
  readonly label: string
}> = [
  { id: '', label: 'Tous types' },
  { id: 'chair', label: 'Chaises' },
  { id: 'armchair', label: 'Fauteuils' },
  { id: 'table', label: 'Tables' },
  { id: 'bench', label: 'Bancs' },
]

const ADJUST_COLLECTION_OPTIONS: ReadonlyArray<{
  readonly id: string
  readonly label: string
}> = [
  { id: '', label: 'Toutes collections' },
  { id: 'BIS-', label: 'Bistrot (BIS-)' },
  { id: 'ROP-', label: 'Cordage (ROP-)' },
  { id: 'TES-', label: 'Textilène (TES-)' },
  { id: 'TBA-', label: 'Piètements (TBA-)' },
]

function ScopedAdjustmentPanel({
  rows,
  previewing,
  applying,
  lastApplied,
  onPreview,
  onApply,
  onClear,
}: {
  readonly rows: ReadonlyArray<PriceAdjustmentRow> | null
  readonly previewing: boolean
  readonly applying: boolean
  readonly lastApplied: number | null
  readonly onPreview: (scope: PriceAdjustmentScope) => void
  readonly onApply: (scope: PriceAdjustmentScope) => void
  readonly onClear: () => void
}) {
  const [category, setCategory] = useState('')
  const [collection, setCollection] = useState('')
  const [percentInput, setPercentInput] = useState('')
  const [previewedScope, setPreviewedScope] =
    useState<PriceAdjustmentScope | null>(null)

  const percent = Number(percentInput.trim().replace(',', '.'))
  const percentValid =
    percentInput.trim() !== '' &&
    Number.isFinite(percent) &&
    percent !== 0 &&
    percent >= -50 &&
    percent <= 100

  function buildScope(): PriceAdjustmentScope {
    return {
      category: category || undefined,
      skuPrefix: collection || undefined,
      percent,
    }
  }

  // Tout changement de périmètre rend l'aperçu périmé.
  function invalidatePreview(): void {
    if (previewedScope !== null) {
      setPreviewedScope(null)
      onClear()
    }
  }

  const belowFloor = (rows ?? []).filter((row) => row.belowFloor)

  return (
    <div className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div>
        <div className="label-eyebrow text-muted-foreground">
          Ajustement ciblé des prix
        </div>
        <div className="mt-1 text-sm font-medium">
          ±X % sur une catégorie ou une collection, sans toucher au reste
        </div>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground">
          Les prix revendeur / distributeur suivent automatiquement (ils
          dérivent du prix de base). Aperçu obligatoire avant application.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-xs text-muted-foreground">
          <span>Type</span>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              invalidatePreview()
            }}
            className="block h-9 rounded-sm border border-[color:var(--sand-deep)] bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            {ADJUST_CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-muted-foreground">
          <span>Collection</span>
          <select
            value={collection}
            onChange={(event) => {
              setCollection(event.target.value)
              invalidatePreview()
            }}
            className="block h-9 rounded-sm border border-[color:var(--sand-deep)] bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            {ADJUST_COLLECTION_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-muted-foreground">
          <span>Ajustement (%)</span>
          <input
            type="number"
            step="0.5"
            min="-50"
            max="100"
            value={percentInput}
            placeholder="ex. 5 ou -3"
            onChange={(event) => {
              setPercentInput(event.target.value)
              invalidatePreview()
            }}
            className="block h-9 w-28 rounded-sm border border-[color:var(--sand-deep)] bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 rounded-sm"
          disabled={!percentValid || previewing || applying}
          onClick={() => {
            const scope = buildScope()
            setPreviewedScope(scope)
            onPreview(scope)
          }}
        >
          <Calculator className="h-3.5 w-3.5" />
          {previewing ? 'Calcul…' : "Prévisualiser l'ajustement"}
        </Button>
        {rows !== null && previewedScope !== null && rows.length > 0 && (
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-sm"
            disabled={applying}
            onClick={() => onApply(previewedScope)}
          >
            {applying
              ? 'Application…'
              : `Appliquer ${previewedScope.percent > 0 ? '+' : ''}${previewedScope.percent}% (${rows.length} produits)`}
          </Button>
        )}
      </div>

      {lastApplied !== null && (
        <div className="rounded-sm border border-[color:var(--forest)]/35 bg-[color:var(--forest)]/8 px-3 py-2 text-xs">
          Ajustement appliqué : {lastApplied} prix mis à jour.
        </div>
      )}

      {rows !== null &&
        (rows.length === 0 ? (
          <div className="rounded-sm bg-[color:var(--sand-soft)] px-3 py-2 text-xs text-muted-foreground">
            Aucun produit actif ne correspond à ce périmètre.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-sm bg-[color:var(--sand-soft)] px-2 py-1">
                {rows.length} produits concernés
              </span>
              <span
                className={`rounded-sm px-2 py-1 ${
                  belowFloor.length > 0
                    ? 'bg-amber-50 text-amber-950'
                    : 'bg-[color:var(--sand-soft)]'
                }`}
              >
                {belowFloor.length} passeraient sous le plancher de marge
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded-sm border border-[color:var(--sand-deep)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[color:var(--sand-soft)] text-left">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">SKU</th>
                    <th className="px-2 py-1.5 font-medium">Produit</th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Actuel HT
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Nouveau HT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-t border-[color:var(--sand-deep)]"
                    >
                      <td className="px-2 py-1.5 font-mono">{row.sku}</td>
                      <td className="max-w-52 truncate px-2 py-1.5">
                        {row.name}
                        {row.belowFloor && (
                          <span className="ml-1.5 rounded-sm bg-amber-100 px-1 py-0.5 text-[10px] text-amber-950">
                            sous plancher
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {EUR_PRECISE.format(row.currentPriceHt)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        {EUR_PRECISE.format(row.newPriceHt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </div>
  )
}

// P0.2 — historique des versions de paramètres : chaque sauvegarde crée une
// ligne, restaurer = re-sauvegarder les valeurs d'une ancienne version.
function PricingVersionHistory({
  versions,
  activeVersion,
  restoringId,
  onRestore,
}: {
  readonly versions: ReadonlyArray<AdminPricingParameters>
  readonly activeVersion: number | null
  readonly restoringId: string | null
  readonly onRestore: (version: AdminPricingParameters) => void
}) {
  const [open, setOpen] = useState(false)
  if (versions.length <= 1) return null

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" />
          Historique des paramètres ({versions.length} versions)
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? 'Replier' : 'Déplier'}
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-1.5">
          {versions.map((version) => {
            const isActive = version.version === activeVersion
            return (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[color:var(--sand-deep)] px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">v{version.version}</span>
                  <span className="text-muted-foreground">
                    {version.label}
                  </span>
                  {isActive && (
                    <span className="rounded-sm bg-[color:var(--forest)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--forest)]">
                      active
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground tabular-nums">
                    fret {version.freightEur40hc.toFixed(0)} € · marge directe{' '}
                    {(version.directMarginRate * 100).toFixed(0)}%
                  </span>
                  {!isActive && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-sm px-2 text-xs"
                      disabled={restoringId !== null}
                      onClick={() => onRestore(version)}
                    >
                      {restoringId === version.id
                        ? 'Restauration…'
                        : 'Restaurer'}
                    </Button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function AdminCatalogueTab({ authStatus }: AdminCatalogueTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<AdminProduct>>([])
  const [containers, setContainers] = useState<
    ReadonlyArray<AdminContainerOption>
  >([])
  const [pricingParameters, setPricingParameters] =
    useState<AdminPricingParameters | null>(null)
  const [pricingSaving, setPricingSaving] = useState(false)
  const [pricingVersions, setPricingVersions] = useState<
    ReadonlyArray<AdminPricingParameters>
  >([])
  const [controlStatus, setControlStatus] =
    useState<PricingControlStatus | null>(null)
  const [repriceRows, setRepriceRows] =
    useState<ReadonlyArray<RepriceRow> | null>(null)
  const [repricePreviewing, setRepricePreviewing] = useState(false)
  const [repriceApplying, setRepriceApplying] = useState(false)
  const [repriceLastApplied, setRepriceLastApplied] = useState<number | null>(
    null,
  )
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(
    null,
  )
  const [adjustRows, setAdjustRows] =
    useState<ReadonlyArray<PriceAdjustmentRow> | null>(null)
  const [adjustPreviewing, setAdjustPreviewing] = useState(false)
  const [adjustApplying, setAdjustApplying] = useState(false)
  const [adjustLastApplied, setAdjustLastApplied] = useState<number | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [stockForProduct, setStockForProduct] = useState<AdminProduct | null>(
    null,
  )
  const [importingBistro, setImportingBistro] = useState(false)
  const [importingRope, setImportingRope] = useState(false)
  const [importingTeslin, setImportingTeslin] = useState(false)
  const [importingTableBase, setImportingTableBase] = useState(false)
  const [categoryFilter, setCategoryFilter] =
    useState<AdminCategoryFilter>('all')
  const [collectionFilter, setCollectionFilter] =
    useState<AdminCollectionFilter>('all')
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('all')
  const [search, setSearch] = useState('')

  const auth = useAuth()
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const categoryCounts = useMemo(() => {
    const counts = countByFilter(
      rows,
      CATEGORY_FILTERS,
      (row) => row.category as AdminCategoryFilter,
    )
    counts.all = rows.length
    return counts
  }, [rows])

  const collectionCounts = useMemo(() => {
    const counts = countByFilter(
      rows,
      COLLECTION_FILTERS,
      (row) => getProductCollection(row) as AdminCollectionFilter,
    )
    counts.all = rows.length
    return counts
  }, [rows])

  const statusCounts = useMemo(() => {
    const counts = countByFilter(rows, STATUS_FILTERS, (row) =>
      row.isActive ? 'active' : 'inactive',
    )
    counts.all = rows.length
    return counts
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr-FR')
    return rows.filter((row) => {
      const categoryMatch =
        categoryFilter === 'all' || row.category === categoryFilter
      const collectionMatch =
        collectionFilter === 'all' ||
        getProductCollection(row) === collectionFilter
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? row.isActive : !row.isActive)
      const searchMatch =
        query.length === 0 ||
        [row.name, row.sku, row.description, CATEGORY_LABEL[row.category]]
          .join(' ')
          .toLocaleLowerCase('fr-FR')
          .includes(query)
      return categoryMatch && collectionMatch && statusMatch && searchMatch
    })
  }, [categoryFilter, collectionFilter, rows, search, statusFilter])

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setError('Supabase non configuré. Ajoutez VITE_SUPABASE_URL/ANON_KEY.')
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
      try {
        const [products, containerRows, activePricingParameters] =
          await Promise.all([
          listProducts(client),
          listAdminContainers(client),
          getActivePricingParameters(client),
        ])
        // P0 pilotage : historique + témoin. Tolérants tant que la migration
        // 20260709090000 n'est pas appliquée (RPC absente ≠ panne du tab).
        const [versions, control] = await Promise.all([
          listPricingParameterVersions(client).catch(
            () => [] as ReadonlyArray<AdminPricingParameters>,
          ),
          checkPricingControl(client).catch(() => null),
        ])
        setRows(products)
        setContainers(containerRows)
        setPricingParameters(activePricingParameters)
        setPricingVersions(versions)
        setControlStatus(control)
        setError(null)
        // Propagate to the public-facing catalogue store so edits show up
        // live in the same session (the store is otherwise load-once).
        void useCatalogStore.getState().reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
      setLoading(false)
    }
  }, [config, isConfigured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function toggleActive(row: AdminProduct): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      if (row.isActive) await softDeleteProduct(client, row.id)
      else await reactivateProduct(client, row.id)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: row.isActive ? 'product.deactivate' : 'product.activate',
        target: row.id,
        extra: { sku: row.sku, name: row.name },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function importProductCollection({
    products,
    startSortOrder,
    action,
    target,
    setImporting,
  }: {
    readonly products: ReadonlyArray<Product>
    readonly startSortOrder: number
    readonly action: string
    readonly target: string
    readonly setImporting: (value: boolean) => void
  }): Promise<void> {
    if (!isConfigured) return
    setImporting(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient

    try {
      for (const [index, product] of products.entries()) {
        await upsertProduct(client, {
          id: product.id,
          sku: product.sku,
          category: product.category,
          name: product.name,
          description: product.description,
          dim_length_cm: product.dimensions.l,
          dim_width_cm: product.dimensions.w,
          dim_height_cm: product.dimensions.h,
          cbm_per_unit: product.cbmPerUnit,
          weight_kg: product.weightKg,
          moq_units: product.moqUnits,
          base_price_ht: product.basePriceHt,
          retail_price_ref: product.retailPriceRef,
          eco_contribution: product.ecoContribution,
          main_image_url: product.mainImageUrl,
          gallery_urls: [...product.galleryUrls],
          features: [...product.features],
          fire_rating: product.fireRating ?? null,
          is_active: true,
          sort_order: startSortOrder + index,
        })

        for (const [variantIndex, variant] of product.variants.entries()) {
          await upsertVariant(client, {
            id: variant.id,
            product_id: product.id,
            name: variant.name,
            image_url: variant.imageUrl ?? null,
            gallery_urls: [...(variant.galleryUrls ?? [])],
            sort_order: variantIndex,
          })
        }
      }

      await logAdminAction(client, auth.user?.id ?? null, {
        action,
        target,
        extra: { count: products.length },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setImporting(false)
    }
  }

  async function importBistroProducts(): Promise<void> {
    if (importingBistro) return
    await importProductCollection({
      products: BISTRO_PRODUCTS,
      startSortOrder: 1000,
      action: 'catalogue.import_bistro_collection',
      target: 'bistro-products',
      setImporting: setImportingBistro,
    })
  }

  async function importRopeProducts(): Promise<void> {
    if (importingRope) return
    await importProductCollection({
      products: ROPE_PRODUCTS,
      startSortOrder: 2000,
      action: 'catalogue.import_rope_collection',
      target: 'rope-products',
      setImporting: setImportingRope,
    })
  }

  async function importTeslinProducts(): Promise<void> {
    if (importingTeslin) return
    await importProductCollection({
      products: TESLIN_PRODUCTS,
      startSortOrder: 3000,
      action: 'catalogue.import_teslin_collection',
      target: 'teslin-products',
      setImporting: setImportingTeslin,
    })
  }

  async function importTableBaseProducts(): Promise<void> {
    if (importingTableBase) return
    await importProductCollection({
      products: TABLE_BASE_PRODUCTS,
      startSortOrder: 4000,
      action: 'catalogue.import_table_base_collection',
      target: 'table-base-products',
      setImporting: setImportingTableBase,
    })
  }

  async function savePricingParameters(
    payload: Parameters<typeof updatePricingParameters>[2],
    label?: string,
  ): Promise<void> {
    if (!isConfigured || !pricingParameters) return
    setPricingSaving(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      // P0.2 : chaque sauvegarde crée une nouvelle version (historique
      // immuable + re-tamponnage du témoin). Repli sur l'update en place
      // tant que la migration 20260709090000 n'est pas appliquée.
      try {
        await savePricingParametersVersion(
          client,
          label ? { ...payload, label } : payload,
        )
      } catch (rpcError) {
        const message =
          rpcError instanceof Error ? rpcError.message : String(rpcError)
        if (!message.includes('admin_save_pricing_parameters')) throw rpcError
        await updatePricingParameters(client, pricingParameters.id, payload)
      }
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'pricing_parameters.save_version',
        target: pricingParameters.id,
        extra: { fields: Object.keys(payload), label: label ?? null },
      })
      // Un aperçu de recalcul calculé avec les anciens paramètres est périmé.
      setRepriceRows(null)
      setRepriceLastApplied(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setPricingSaving(false)
    }
  }

  async function restorePricingVersion(
    version: AdminPricingParameters,
  ): Promise<void> {
    if (restoringVersionId) return
    setRestoringVersionId(version.id)
    try {
      await savePricingParameters(
        {
          fx_usd_eur: version.fxUsdEur,
          freight_eur_40hc: version.freightEur40hc,
          useful_container_cbm_40hc: version.usefulContainerCbm40hc,
          customs_rate: version.customsRate,
          import_insurance_rate: version.importInsuranceRate,
          fixed_import_fee_eur: version.fixedImportFeeEur,
          direct_margin_rate: version.directMarginRate,
          reseller_margin_rate: version.resellerMarginRate,
          distributor_margin_rate: version.distributorMarginRate,
          min_margin_floor: version.minMarginFloor,
          loss_leader_min_lot: version.lossLeaderMinLot,
          tier2_qty: version.tier2Qty,
          tier2_discount: version.tier2Discount,
          tier3_qty: version.tier3Qty,
          tier3_discount: version.tier3Discount,
          reservation_fee_rate: version.reservationFeeRate,
          reservation_fee_min: version.reservationFeeMin,
          reservation_fee_max: version.reservationFeeMax,
        },
        `Restauration v${version.version}`,
      )
    } finally {
      setRestoringVersionId(null)
    }
  }

  async function previewRepriceDiff(): Promise<void> {
    if (!isConfigured || repricePreviewing) return
    setRepricePreviewing(true)
    setRepriceLastApplied(null)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      setRepriceRows(await previewReprice(client))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setRepricePreviewing(false)
    }
  }

  async function previewAdjustment(scope: PriceAdjustmentScope): Promise<void> {
    if (!isConfigured || adjustPreviewing) return
    setAdjustPreviewing(true)
    setAdjustLastApplied(null)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      setAdjustRows(await previewPriceAdjustment(client, scope))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setAdjustPreviewing(false)
    }
  }

  async function applyAdjustment(scope: PriceAdjustmentScope): Promise<void> {
    if (!isConfigured || adjustApplying) return
    setAdjustApplying(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      const updated = await applyPriceAdjustment(client, scope)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'pricing.scoped_adjustment_apply',
        target: 'products.base_price_ht',
        extra: {
          updated,
          percent: scope.percent,
          category: scope.category ?? null,
          sku_prefix: scope.skuPrefix ?? null,
        },
      })
      setAdjustLastApplied(updated)
      setAdjustRows(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setAdjustApplying(false)
    }
  }

  async function applyRepriceDiff(): Promise<void> {
    if (!isConfigured || repriceApplying) return
    setRepriceApplying(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      const updated = await applyReprice(client)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'pricing.reprice_apply',
        target: 'products.base_price_ht',
        extra: { updated },
      })
      setRepriceLastApplied(updated)
      setRepriceRows(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setRepriceApplying(false)
    }
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger le catalogue.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions
          d&apos;édition seront refusées par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-sm"
          disabled={importingBistro}
          onClick={() => void importBistroProducts()}
        >
          <Download className="h-3.5 w-3.5" />
          {importingBistro ? 'Import en cours…' : 'Importer collection bistrot'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-sm"
          disabled={importingRope}
          onClick={() => void importRopeProducts()}
        >
          <Download className="h-3.5 w-3.5" />
          {importingRope ? 'Import en cours…' : 'Importer collection cordage'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-sm"
          disabled={importingTeslin}
          onClick={() => void importTeslinProducts()}
        >
          <Download className="h-3.5 w-3.5" />
          {importingTeslin
            ? 'Import en cours…'
            : 'Importer collection textilène'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-sm"
          disabled={importingTableBase}
          onClick={() => void importTableBaseProducts()}
        >
          <Download className="h-3.5 w-3.5" />
          {importingTableBase
            ? 'Import en cours…'
            : 'Importer piètements de table'}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 rounded-sm"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un produit
        </Button>
      </div>

      {controlStatus && <PricingControlBanner status={controlStatus} />}

      {pricingParameters && (
        <PricingParametersPanel
          parameters={pricingParameters}
          saving={pricingSaving}
          onSave={(payload) => void savePricingParameters(payload)}
        />
      )}

      {pricingParameters && (
        <RepricePanel
          rows={repriceRows}
          previewing={repricePreviewing}
          applying={repriceApplying}
          lastApplied={repriceLastApplied}
          onPreview={() => void previewRepriceDiff()}
          onApply={() => void applyRepriceDiff()}
          onClose={() => setRepriceRows(null)}
        />
      )}

      {pricingParameters && (
        <ScopedAdjustmentPanel
          rows={adjustRows}
          previewing={adjustPreviewing}
          applying={adjustApplying}
          lastApplied={adjustLastApplied}
          onPreview={(scope) => void previewAdjustment(scope)}
          onApply={(scope) => void applyAdjustment(scope)}
          onClear={() => setAdjustRows(null)}
        />
      )}

      <PricingVersionHistory
        versions={pricingVersions}
        activeVersion={pricingParameters?.version ?? null}
        restoringId={restoringVersionId}
        onRestore={(version) => void restorePricingVersion(version)}
      />

      <div className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center">
          <label className="block">
            <span className="sr-only">Rechercher un produit</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, SKU, description…"
              className="h-9 w-full rounded-sm border border-[color:var(--sand-deep)] bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </label>
          <div className="text-xs text-muted-foreground">
            {filteredRows.length} / {rows.length} produits affichés
          </div>
        </div>

        <FilterGroup label="Type">
          {CATEGORY_FILTERS.map((filter) => (
            <FilterButton
              key={filter.id}
              active={categoryFilter === filter.id}
              onClick={() => setCategoryFilter(filter.id)}
            >
              {filter.label} ({categoryCounts[filter.id] ?? 0})
            </FilterButton>
          ))}
        </FilterGroup>

        <FilterGroup label="Collection">
          {COLLECTION_FILTERS.map((filter) => (
            <FilterButton
              key={filter.id}
              active={collectionFilter === filter.id}
              onClick={() => setCollectionFilter(filter.id)}
            >
              {filter.label} ({collectionCounts[filter.id] ?? 0})
            </FilterButton>
          ))}
        </FilterGroup>

        <FilterGroup label="État">
          {STATUS_FILTERS.map((filter) => (
            <FilterButton
              key={filter.id}
              active={statusFilter === filter.id}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label} ({statusCounts[filter.id] ?? 0})
            </FilterButton>
          ))}
        </FilterGroup>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[74px_minmax(180px,1.4fr)_100px_70px_90px_100px_110px_90px_70px_220px] md:gap-3">
          <span>Image</span>
          <span>Produit</span>
          <span>Catégorie</span>
          <span>MOQ</span>
          <span className="text-right">Prix direct</span>
          <span className="text-right">Prix partenaire</span>
          <span className="text-right">Bénéfice/u.</span>
          <span>État</span>
          <span>Variantes</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucun produit.
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucun produit ne correspond à ces filtres.
            </div>
          ) : (
            filteredRows.map((row) => {
              const busy = busyId === row.id
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[74px_minmax(180px,1.4fr)_100px_70px_90px_100px_110px_90px_70px_220px] md:items-center md:gap-3"
                >
                  <div className="flex items-start gap-3 md:block">
                    <div className="ring-foreground/10 h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-[color:var(--sand-soft)] ring-1">
                      {row.mainImageUrl ? (
                        <img
                          src={row.mainImageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.sku}
                    </div>
                    <div
                      className={`mt-1 inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${
                        row.fobUsd !== null && row.qtyPerContainer !== null
                          ? 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {row.fobUsd !== null && row.qtyPerContainer !== null
                        ? 'Pricing prêt'
                        : 'Coûts à compléter'}
                    </div>
                  </div>
                  <span className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-0.5 text-[11px]">
                    {CATEGORY_LABEL[row.category]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.moqUnits}
                  </span>
                  <span className="font-medium tabular-nums md:text-right">
                    {row.basePriceHt.toFixed(2)} €
                  </span>
                  <span className="font-medium tabular-nums text-muted-foreground md:text-right">
                    {row.partnerNetPriceHt !== null
                      ? `${row.partnerNetPriceHt.toFixed(2)} €`
                      : '—'}
                  </span>
                  <ProductProfitCell
                    row={row}
                    parameters={pricingParameters}
                  />
                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                      row.isActive
                        ? 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]'
                        : 'bg-[color:var(--sand-deep)] text-muted-foreground'
                    }`}
                  >
                    {row.isActive ? 'Actif' : 'Désactivé'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.variantsCount}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-sm"
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Éditer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-sm"
                      onClick={() => setStockForProduct(row)}
                      title="Créer une ligne de stock 24h pour ce produit"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      Stock
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-sm"
                      disabled={busy}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.isActive ? (
                        <>
                          <PowerOff className="h-3.5 w-3.5" />
                          Désactiver
                        </>
                      ) : (
                        <>
                          <Power className="h-3.5 w-3.5" />
                          Activer
                        </>
                      )}
                    </Button>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      <Dialog
        open={editing !== null || creating}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setCreating(false)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creating
                ? 'Nouveau produit'
                : `Éditer le produit ${editing?.sku ?? ''}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulaire administrateur pour gérer la fiche produit, les
              variantes et les engagements container.
            </DialogDescription>
          </DialogHeader>
          {(editing || creating) && (
            <AdminProductEditor
              productId={creating ? null : editing!.id}
              containers={containers}
              onSaved={async () => {
                setEditing(null)
                setCreating(false)
                await refresh()
              }}
              onCancel={() => {
                setEditing(null)
                setCreating(false)
              }}
            />
          )}
          <DialogFooter className="text-[11px] text-muted-foreground">
            Les enregistrements passent par UPSERT Supabase. Les erreurs RLS
            apparaissent ici.
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stockForProduct !== null}
        onOpenChange={(open) => {
          if (!open) setStockForProduct(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Mettre au stock — {stockForProduct?.name ?? ''}
            </DialogTitle>
          </DialogHeader>
          {stockForProduct && (
            <AdminStockEditor
              line={null}
              products={rows}
              containers={containers}
              initialProductId={stockForProduct.id}
              onProductCreated={refresh}
              onSaved={() => setStockForProduct(null)}
              onCancel={() => setStockForProduct(null)}
            />
          )}
          <DialogFooter className="text-[11px] text-muted-foreground">
            La fiche produit est réutilisée — vous ne saisissez que la
            disponibilité, le prix stock et les photos du lot.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterGroup({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean
  readonly onClick: () => void
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-2.5 py-1 text-xs transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-[color:var(--sand-deep)] bg-background text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
