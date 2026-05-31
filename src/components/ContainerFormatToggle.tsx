// Two-button switch between the active 20' (group-buy default) and a
// 40' High Cube for distributor-scale orders. We deliberately surface
// VOLUME and the relative gain, not € prices — import freight rates
// move too much to commit a number that would mislead the client.

import { Container } from 'lucide-react'

import {
  CONTAINER_USABLE_CBM,
  getVolumeUpgradeDelta,
} from '@/lib/container/pricing'
import type { ContainerType } from '@/lib/supabase/types'

const SMALL_FORMAT: ContainerType = '20_hc'
const LARGE_FORMAT: ContainerType = '40_hc'

const OPTIONS: Array<{
  readonly type: ContainerType
  readonly title: string
  readonly subtitle: string
}> = [
  {
    type: SMALL_FORMAT,
    title: "20'",
    subtitle: 'groupage',
  },
  {
    type: LARGE_FORMAT,
    title: "40'",
    subtitle: 'distributeur',
  },
]

export interface ContainerFormatToggleProps {
  readonly value: ContainerType
  readonly onChange: (type: ContainerType) => void
}

export function ContainerFormatToggle({
  value,
  onChange,
}: ContainerFormatToggleProps) {
  const upgrade = getVolumeUpgradeDelta(SMALL_FORMAT, LARGE_FORMAT)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <Container className="h-3 w-3" />
        Format container
      </div>
      <div className="flex gap-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-1">
        {OPTIONS.map((option) => {
          const active = option.type === value
          const usable = CONTAINER_USABLE_CBM[option.type]
          const isLarge = option.type === LARGE_FORMAT
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onChange(option.type)}
              aria-pressed={active}
              className={`flex-1 rounded-sm px-2 py-2 text-left transition-colors ${
                active
                  ? 'bg-foreground text-background'
                  : 'text-foreground/75 hover:bg-card hover:text-foreground'
              }`}
            >
              <div className="font-display text-base font-semibold leading-none tracking-tight">
                {option.title}
              </div>
              <div
                className={`mt-0.5 text-[10px] ${
                  active ? 'text-background/65' : 'text-muted-foreground'
                }`}
              >
                {option.subtitle}
              </div>
              <div
                className={`mt-1 text-[10px] tabular-nums ${
                  active ? 'text-background/80' : 'text-foreground/65'
                }`}
              >
                {usable} m³{isLarge ? ` · +${upgrade.gainPercent}%` : ''}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
