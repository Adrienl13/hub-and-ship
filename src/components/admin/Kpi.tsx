import type { LucideIcon } from 'lucide-react'

// Tuile indicateur du back-office : icône + libellé en surtitre, valeur en
// grand, détail en dessous. Partagée entre la vue générale (admin.tsx) et les
// indicateurs 12 mois (AdminOverviewKpis).
export function Kpi({
  Icon,
  label,
  value,
  detail,
}: {
  readonly Icon: LucideIcon
  readonly label: string
  readonly value: string
  readonly detail: string
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="label-eyebrow">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}
