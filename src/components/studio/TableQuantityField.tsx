import { getQuantityRule } from '@/lib/quantity'
import { composedQuantityRule } from '@/lib/table-composer'
import type { StudioProduct } from '@/lib/studio/types'
import type { TableConfiguration } from '@/lib/studio/table-project'
import { studioButton } from './StudioChoices'
export function TableQuantityField({
  config,
  top,
  base,
  onChange,
  suggestion,
}: {
  config: TableConfiguration
  top?: StudioProduct
  base?: StudioProduct
  onChange: (n: number) => void
  suggestion: number
}) {
  const topVariant = top?.variants.find((v) => v.id === config.top?.variantId),
    baseVariant = base?.variants.find((v) => v.id === config.base?.variantId)
  const rule =
    top && topVariant
      ? base && baseVariant
        ? composedQuantityRule({ top, topVariant, base, baseVariant })
        : getQuantityRule(top, topVariant)
      : null
  return (
    <section className="border-y border-[color:var(--sand-deep)] py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <label
            htmlFor={`quantity-${config.id}`}
            className="text-lg font-semibold"
          >
            Quantité de tables
          </label>
          <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
            {!config.quantityEdited
              ? `Suggestion initiale : ${suggestion}. `
              : ''}
            Choisissez la quantité de votre projet.
          </p>
        </div>
        <input
          id={`quantity-${config.id}`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className={`${studioButton} w-28 bg-[color:var(--paper)] text-lg`}
          value={config.quantity}
          onChange={(e) => {
            if (
              e.target.value !== '' &&
              Number.isFinite(Number(e.target.value))
            )
              onChange(Number(e.target.value))
          }}
        />
      </div>
      {rule && (
        <p role="status" className="mt-3 text-sm text-[color:var(--ink-soft)]">
          {rule.label}.{' '}
          {config.quantity < rule.minimum
            ? 'Cette quantité nécessite une étude ; vous pouvez continuer.'
            : 'Le minimum de série est indicatif. La disponibilité reste à confirmer.'}
        </p>
      )}
    </section>
  )
}
