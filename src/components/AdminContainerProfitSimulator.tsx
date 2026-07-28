import { useMemo, useState } from 'react'
import { AlertTriangle, Container, TrendingDown, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type {
  AdminPricingParameters,
  AdminProduct,
} from '@/lib/catalogue-admin/types'
import { channelCoefficientFromMargins } from '@/lib/pricing/channel'
import {
  computeContainerProfit,
  freightForFormat,
  maxSafeRfaPercent,
  PROFIT_FORMAT_LABEL,
  PROFIT_FORMAT_USABLE_CBM,
  type ContainerMixLine,
  type ProfitContainerFormat,
} from '@/lib/pricing/container-profit'
import { formatEUR } from '@/lib/order'

// Simulateur « Rentabilité container » — répond à la question du pilotage :
// un 20' GP rempli avec MES produits, vendu par TEL canal, rapporte combien ?
// Toutes les données viennent des fiches produits réelles (FOB, m³, prix) et
// des paramètres pricing actifs — rien n'est codé en dur.

type Scenario =
  | 'direct'
  | 'direct_tier2'
  | 'direct_tier3'
  | 'revendeur'
  | 'distributeur'
  | 'grand_compte'

const SCENARIO_LABEL: Record<Scenario, string> = {
  direct: 'Direct — plein tarif',
  direct_tier2: 'Direct — palier 2',
  direct_tier3: 'Direct — palier 3',
  revendeur: 'Revendeur (prix net)',
  distributeur: 'Distributeur (prix net)',
  grand_compte: 'Grand compte (−palier 3 d’office)',
}

const FORMATS: ReadonlyArray<ProfitContainerFormat> = ['20_gp', '40_gp', '40_hc']

/** Prix unitaire HT du scénario pour un produit, depuis les paramètres actifs. */
function scenarioUnitPrice(
  product: AdminProduct,
  scenario: Scenario,
  params: AdminPricingParameters,
): number {
  const base = product.basePriceHt
  switch (scenario) {
    case 'direct':
      return base
    case 'direct_tier2':
      return base * (1 - params.tier2Discount)
    case 'direct_tier3':
      return base * (1 - params.tier3Discount)
    case 'grand_compte':
      return base * (1 - params.tier3Discount)
    case 'revendeur':
      return (
        product.partnerNetPriceHt ??
        base *
          channelCoefficientFromMargins(
            params.directMarginRate,
            params.resellerMarginRate,
          )
      )
    case 'distributeur':
      return (
        base *
        channelCoefficientFromMargins(
          params.directMarginRate,
          params.distributorMarginRate,
        )
      )
  }
}

export function AdminContainerProfitSimulator({
  products,
  parameters,
}: {
  readonly products: ReadonlyArray<AdminProduct>
  readonly parameters: AdminPricingParameters
}) {
  const [format, setFormat] = useState<ProfitContainerFormat>('20_gp')
  const [scenario, setScenario] = useState<Scenario>('direct')
  const [includeCommission, setIncludeCommission] = useState(false)
  const [rfaPercent, setRfaPercent] = useState('0')
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({})

  // Seuls les produits actifs avec un prix sont proposables ; ceux sans FOB
  // sont affichés mais signalés (coût inconnu = bénéfice surestimé).
  const candidates = useMemo(
    () =>
      products.filter(
        (product) => product.isActive && product.basePriceHt > 0,
      ),
    [products],
  )

  const usableCbm = PROFIT_FORMAT_USABLE_CBM[format]
  const freight = freightForFormat(format, parameters)

  const mixLines: ContainerMixLine[] = useMemo(
    () =>
      candidates
        .map((product) => ({
          productId: product.id,
          name: product.name,
          unitPriceHt: scenarioUnitPrice(product, scenario, parameters),
          fobUsd: product.fobUsd,
          cbmPerUnit: product.cbmPerUnit,
          quantity: qtyByProduct[product.id] ?? 0,
        }))
        .filter((line) => line.quantity > 0),
    [candidates, scenario, parameters, qtyByProduct],
  )

  const result = useMemo(
    () =>
      computeContainerProfit({
        format,
        lines: mixLines,
        params: parameters,
        includeCommission,
        rfaPercent: Number(rfaPercent) || 0,
      }),
    [format, mixLines, parameters, includeCommission, rfaPercent],
  )

  const rfaCeiling = maxSafeRfaPercent(parameters.minMarginFloor)
  const partnerScenario =
    scenario === 'revendeur' || scenario === 'distributeur'

  function setQty(productId: string, value: number): void {
    setQtyByProduct((prev) => ({
      ...prev,
      [productId]: Math.max(0, Math.round(value)),
    }))
  }

  /** Remplit le container avec ce seul produit (mono-référence). */
  function fillWith(product: AdminProduct): void {
    if (product.cbmPerUnit <= 0) return
    setQtyByProduct({
      [product.id]: Math.floor(usableCbm / product.cbmPerUnit),
    })
  }

  return (
    <section className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Rentabilité container
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <Container className="h-4 w-4" />
            Bénéfice estimé par format et par canal
          </div>
        </div>
      </div>

      {/* Choix du format + scénario */}
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              format === f
                ? 'border-[color:var(--ember)] bg-[color:var(--ember)] text-white'
                : 'border-[color:var(--sand-deep)] hover:bg-[color:var(--sand-soft)]'
            }`}
          >
            {PROFIT_FORMAT_LABEL[f]} · {PROFIT_FORMAT_USABLE_CBM[f]} m³
          </button>
        ))}
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as Scenario)}
          aria-label="Scénario de vente"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          {(Object.keys(SCENARIO_LABEL) as Scenario[]).map((key) => (
            <option key={key} value={key}>
              {SCENARIO_LABEL[key]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={includeCommission}
            onChange={(e) => setIncludeCommission(e.target.checked)}
          />
          Commission apporteur 8 %
        </label>
        {partnerScenario && (
          <label className="flex items-center gap-1.5 text-xs">
            RFA
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={rfaPercent}
              onChange={(e) => setRfaPercent(e.target.value)}
              aria-label="RFA en pourcentage du CA"
              className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-xs"
            />
            %
          </label>
        )}
      </div>

      {partnerScenario && includeCommission && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          Garde-fou RFA : avec un prix au plancher de marge (+
          {Math.round(parameters.minMarginFloor * 100)} %) et la commission
          apporteur 8 %, la RFA maximale sans vente à perte est d&apos;environ{' '}
          <strong>{rfaCeiling.toFixed(1)} %</strong> du CA. À contractualiser
          comme plafond.
        </div>
      )}

      {freight === null && (
        <div className="flex items-start gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Fret {PROFIT_FORMAT_LABEL[format]} non renseigné — saisissez votre
            cotation réelle dans « Paramètres pricing » ci-dessus (champ «
            Fret {format === '20_gp' ? "20' GP" : "40' GP"} »). Le bénéfice ne
            peut pas être calculé sans ce coût.
          </span>
        </div>
      )}

      {/* Mix produits */}
      <div className="max-h-72 overflow-y-auto rounded-sm border border-[color:var(--sand-deep)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[color:var(--sand-soft)] text-left">
            <tr>
              <th className="px-2 py-1.5 font-medium">Produit</th>
              <th className="px-2 py-1.5 text-right font-medium">
                Prix scénario
              </th>
              <th className="px-2 py-1.5 text-right font-medium">m³/u</th>
              <th className="px-2 py-1.5 text-right font-medium">Quantité</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {candidates.map((product) => {
              const unitPrice = scenarioUnitPrice(product, scenario, parameters)
              return (
                <tr
                  key={product.id}
                  className="border-t border-[color:var(--sand-deep)]/60"
                >
                  <td className="max-w-[220px] truncate px-2 py-1.5">
                    {product.name}
                    {product.fobUsd === null && (
                      <span
                        className="ml-1 text-amber-600"
                        title="FOB manquant — coût marchandise inconnu"
                      >
                        ⚠ FOB
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatEUR(unitPrice)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {product.cbmPerUnit.toFixed(3)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={qtyByProduct[product.id] ?? 0}
                      onChange={(e) =>
                        setQty(product.id, Number(e.target.value))
                      }
                      aria-label={`Quantité ${product.name}`}
                      className="h-7 w-20 rounded-md border border-input bg-transparent px-2 text-right text-xs tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => fillWith(product)}
                      disabled={product.cbmPerUnit <= 0}
                    >
                      Remplir
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Résultat */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-xs">
          <Row label="Volume utilisé">
            <span
              className={result.overCapacity ? 'font-bold text-red-700' : ''}
            >
              {result.usedCbm.toFixed(1)} / {result.usableCbm} m³ (
              {result.fillPercent} %)
            </span>
          </Row>
          <Row label="Chiffre d'affaires HT">
            {formatEUR(result.revenueHt)}
          </Row>
          <Row label="Coût marchandise (FOB + douane + assurance)">
            −{formatEUR(result.goodsCostHt)}
          </Row>
          <Row label={`Fret ${PROFIT_FORMAT_LABEL[format]}`}>
            {result.freightEur === null
              ? 'à renseigner'
              : `−${formatEUR(result.freightEur)}`}
          </Row>
          {result.commissionHt > 0 && (
            <Row label="Commission apporteur (8 %)">
              −{formatEUR(result.commissionHt)}
            </Row>
          )}
          {result.rfaHt > 0 && (
            <Row label={`RFA (${rfaPercent} % du CA)`}>
              −{formatEUR(result.rfaHt)}
            </Row>
          )}
        </div>

        <div
          className={`flex flex-col items-center justify-center gap-1 rounded-sm border p-3 ${
            result.profitHt === null
              ? 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]'
              : result.profitHt >= 0
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="label-eyebrow text-muted-foreground">
            Bénéfice estimé du container
          </div>
          {result.profitHt === null ? (
            <div className="text-sm text-muted-foreground">
              Renseignez le fret pour calculer
            </div>
          ) : (
            <>
              <div
                className={`flex items-center gap-2 font-display text-2xl font-extrabold tabular-nums ${
                  result.profitHt >= 0 ? 'text-emerald-800' : 'text-red-800'
                }`}
              >
                {result.profitHt >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {formatEUR(result.profitHt)}
              </div>
              <div className="text-xs text-muted-foreground">
                {result.marginPercent === null
                  ? ''
                  : `${result.marginPercent.toFixed(1)} % du CA`}
              </div>
            </>
          )}
        </div>
      </div>

      {result.overCapacity && (
        <div className="flex items-start gap-1.5 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Le mix dépasse le volume utile du {PROFIT_FORMAT_LABEL[format]} —
          réduisez les quantités ou passez au format supérieur.
        </div>
      )}

      {result.incompleteLines.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            FOB manquant pour : {result.incompleteLines.join(', ')} — leur coût
            marchandise est exclu, le bénéfice affiché est donc SURESTIMÉ.
            Complétez la fiche produit (FOB USD) pour un chiffre fiable.
          </span>
        </div>
      )}
    </section>
  )
}

function Row({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  )
}
