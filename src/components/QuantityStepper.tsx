import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DEFAULT_QUANTITY_RULE,
  getNextOrderQuantity,
  getPreviousOrderQuantity,
  sanitizeOrderQuantity,
  type QuantityRule,
} from '@/lib/quantity'

export function QuantityStepper({
  value,
  onChange,
  size = 'sm',
  rule = DEFAULT_QUANTITY_RULE,
  showRule = false,
}: {
  value: number
  onChange: (value: number) => void
  size?: 'sm' | 'lg'
  rule?: QuantityRule
  showRule?: boolean
}) {
  const buttonSize = size === 'lg' ? 'h-11 w-11' : 'h-7 w-7'
  const inputSize = size === 'lg' ? 'h-11 w-20 text-base' : 'w-16 text-sm'

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} rounded-sm hover:bg-background`}
          onClick={() => onChange(getPreviousOrderQuantity(value, rule))}
          disabled={value === 0}
          aria-label="Diminuer"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <input
          type="number"
          value={value}
          onChange={(event) =>
            onChange(
              sanitizeOrderQuantity(
                Number.parseInt(event.target.value || '0', 10),
                rule,
              ),
            )
          }
          className={`${inputSize} rounded-sm bg-transparent text-center font-semibold tabular-nums [appearance:textfield] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          aria-label="Quantité"
          min={0}
          step={rule.step}
        />
        <Button
          variant="ghost"
          size="icon"
          className={`${buttonSize} rounded-sm hover:bg-background`}
          onClick={() => onChange(getNextOrderQuantity(value, rule))}
          aria-label="Augmenter"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showRule && (
        <div className="mt-1 text-center text-[10px] font-medium text-muted-foreground">
          {rule.label}
        </div>
      )}
    </div>
  )
}
