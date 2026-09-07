// Quantité LIBRE (lot 2) : entier ≥ 1, jamais arrondi, jamais bloquant. La
// règle de série (getQuantityRule) est affichée à titre informatif ; le
// retour (stock réel, voie confirmée, faisabilité) vient du lot 1 via
// describeQuantity. Aucun état n'empêche de continuer.

import { CheckCircle2, CircleHelp, FileSearch } from 'lucide-react'
import { useId } from 'react'

import type { Product } from '@/lib/products'
import { describeQuantity, type QuantityFeedbackTone } from '@/lib/studio/quantity-feedback'
import type { FulfillmentContext, StudioProjectItem } from '@/lib/studio/types'
import { normalizeRequestedQuantity } from '@/stores/studio.store'

const TONE_STYLE: Record<QuantityFeedbackTone, { className: string; Icon: typeof CheckCircle2; label: string }> = {
  confirmed: {
    className: 'border-[color:var(--forest)]/40 bg-[color:var(--forest-bg)] text-[color:var(--ink)]',
    Icon: CheckCircle2,
    label: 'Voie confirmée',
  },
  review: {
    className: 'border-[color:var(--ochre)]/40 bg-[color:var(--color-warning-bg)] text-[color:var(--ink)]',
    Icon: FileSearch,
    label: 'Étude de faisabilité',
  },
  quote: {
    className: 'border-[color:var(--info)]/40 bg-[color:var(--color-info-bg)] text-[color:var(--ink)]',
    Icon: CircleHelp,
    label: 'Devis à confirmer',
  },
}

export function SeatQuantityField({
  item,
  product,
  context,
  onChange,
}: {
  readonly item: StudioProjectItem
  readonly product: Product
  readonly context: FulfillmentContext
  readonly onChange: (quantity: number) => void
}) {
  const inputId = useId()
  const feedback = describeQuantity(item, product, context)
  const tone = TONE_STYLE[feedback.tone]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex-1">
          <label htmlFor={inputId} className="text-sm font-semibold">
            Quantité souhaitée
          </label>
          <p className="text-xs text-[color:var(--ink-soft)]">
            Règle de série indicative : {feedback.ruleLabel}. Vous saisissez la quantité de votre projet.
          </p>
        </div>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={item.requestedQuantity}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            if (event.target.value === '') return
            onChange(normalizeRequestedQuantity(parsed))
          }}
          aria-describedby={`${inputId}-feedback`}
          className="h-12 w-full rounded-md border border-[color:var(--border-strong)] bg-[color:var(--paper)] px-4 text-lg font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] sm:w-36"
        />
      </div>
      <div
        id={`${inputId}-feedback`}
        role="status"
        aria-live="polite"
        data-tone={feedback.tone}
        data-mode={feedback.resolution.mode}
        className={`flex items-start gap-3 rounded-md border p-3 text-sm ${tone.className}`}
      >
        <tone.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <div className="label-eyebrow">{tone.label}</div>
          <p className="mt-0.5 font-medium">{feedback.title}</p>
          {feedback.detail && <p className="mt-0.5 text-[color:var(--ink-soft)]">{feedback.detail}</p>}
          {feedback.resolution.reasons.length > 0 && (
            <p className="mono mt-1 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
              {feedback.resolution.mode} · {feedback.resolution.reasons.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
