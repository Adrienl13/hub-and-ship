// Two-button switch that lets the client pick between the active 20'
// (group-buy default) and a 40' GP for larger orders. The choice
// flows through the cart store, so every consumer downstream — fill
// bar, 3D scene, cost-per-cbm display, downstream reservation — sees
// it instantly.

import { Container } from 'lucide-react'

import {
  CONTAINER_TRANSPORT_COST_EUR,
  CONTAINER_USABLE_CBM,
  getCostPerCbm,
} from '@/lib/container/pricing'
import type { ContainerType } from '@/lib/supabase/types'

const OPTIONS: Array<{
  readonly type: ContainerType
  readonly title: string
  readonly subtitle: string
}> = [
  {
    type: '20_hc',
    title: "20'",
    subtitle: 'groupage',
  },
  {
    type: '40_gp',
    title: "40'",
    subtitle: 'distributeur',
  },
]

export interface ContainerFormatToggleProps {
  readonly value: ContainerType
  readonly onChange: (type: ContainerType) => void
}

function formatEuro(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
}

export function ContainerFormatToggle({
  value,
  onChange,
}: ContainerFormatToggleProps) {
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
          const cost = CONTAINER_TRANSPORT_COST_EUR[option.type]
          const ratePerCbm = Math.round(getCostPerCbm(option.type))
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
                {usable} m³ · {formatEuro(cost)} ({ratePerCbm} €/m³)
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
