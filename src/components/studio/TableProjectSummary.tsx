import {
  EMPTY_CAPABILITIES,
  evaluateCustomization,
  lineTargets,
  tableKey,
  type CustomizationDraft,
  type CapabilityData,
} from '@/lib/studio/customization'
import { CustomizationSummary } from './CustomizationSummary'
import { Link } from '@tanstack/react-router'
import { SafeImage } from '@/components/SafeImage'
import { formatEUR } from '@/lib/order'
import {
  configurationProducts,
  evaluateTable,
  type TableConfiguration,
} from '@/lib/studio/table-project'
import type { TableCompatibilityData } from '@/lib/studio/compatibility'
import type { FulfillmentContext, StudioProduct } from '@/lib/studio/types'
import { studioButton } from './StudioChoices'
export function TableProjectSummary({
  tables,
  productsById,
  compatibility,
  context,
  onQuantityChange,
  onRemove,
  customization = {},
  capabilities = EMPTY_CAPABILITIES,
}: {
  customization?: CustomizationDraft
  capabilities?: CapabilityData
  tables: ReadonlyArray<TableConfiguration>
  productsById: ReadonlyMap<string, StudioProduct>
  compatibility: TableCompatibilityData
  context: FulfillmentContext
  onQuantityChange?: (id: string, n: number) => void
  onRemove?: (id: string) => void
}) {
  return (
    <section aria-label="Tables du projet" className="space-y-4">
      <h3 className="label-eyebrow text-[color:var(--ink-soft)]">Tables</h3>
      {tables.map((table) => {
        const { top, base, topVariant, baseVariant } = configurationProducts(
          table,
          productsById,
        )
        const evaluation = evaluateTable(
          table,
          productsById,
          compatibility,
          context,
        )
        return (
          <article
            key={table.id}
            data-testid="project-table"
            className="border-t border-[color:var(--sand-deep)] pt-4"
          >
            <div className="flex gap-3">
              <SafeImage
                src={topVariant?.imageUrl || top?.mainImageUrl}
                alt={top?.name ?? 'Plateau à définir'}
                className="h-20 w-20 shrink-0 rounded bg-white"
                imgClassName="h-20 w-20 shrink-0 rounded bg-white object-contain p-2"
              />
              <div className="min-w-0">
                <h4 className="font-semibold">Tables × {table.quantity}</h4>
                <p className="text-sm">
                  {table.custom
                    ? 'Plateau sur mesure'
                    : (top?.name ?? 'Plateau à vérifier')}
                </p>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {table.custom
                    ? `${table.custom.shape === 'round' ? 'Rond' : 'Rectangulaire'} · ${table.custom.length} × ${table.custom.width} cm · ${table.custom.finish}`
                    : top
                      ? `${topVariant?.name ?? 'Finition à vérifier'} · ${top.dimensions.l} × ${top.dimensions.w} cm`
                      : ''}
                </p>
                <p className="mt-1 text-xs">
                  {evaluation.compatible
                    ? `${base?.name} · ${baseVariant?.name}`
                    : 'Piètement à confirmer'}
                </p>
              </div>
            </div>
            <p
              className="mt-3 text-xs"
              data-testid="table-compatibility-status"
            >
              {evaluation.compatible
                ? 'Configuration compatible'
                : table.custom
                  ? 'Sur mesure à étudier'
                  : 'Compatibilité à confirmer'}
            </p>
            <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
              {evaluation.total !== null
                ? `${formatEUR(evaluation.total)} HT indicatif`
                : 'Prix de la configuration à confirmer'}
            </p>
            <CustomizationSummary
              rows={
                evaluateCustomization(
                  lineTargets(tableKey(table), table.quantity, {
                    ...(table.top ? { tabletop: table.top.productId } : {}),
                    ...(table.base ? { base: table.base.productId } : {}),
                  }),
                  customization,
                  capabilities,
                ).selections
              }
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                to="/studio/tables"
                search={{ configuration: table.id }}
                className={studioButton}
              >
                Modifier la table
              </Link>
              {onQuantityChange && (
                <label className="text-xs">
                  Qté
                  <input
                    aria-label={`Quantité de tables ${top?.name ?? 'sur mesure'}`}
                    type="number"
                    min={1}
                    step={1}
                    value={table.quantity}
                    onChange={(e) => {
                      if (e.target.value !== '')
                        onQuantityChange(table.id, Number(e.target.value))
                    }}
                    className="ml-2 min-h-[44px] w-16 rounded border bg-white px-2"
                  />
                </label>
              )}
              {onRemove && (
                <button
                  type="button"
                  className={studioButton}
                  onClick={() => onRemove(table.id)}
                  aria-label={`Retirer la table ${top?.name ?? 'sur mesure'}`}
                >
                  Retirer
                </button>
              )}
            </div>
          </article>
        )
      })}
    </section>
  )
}
