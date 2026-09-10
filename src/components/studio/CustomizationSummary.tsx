import {
  selectionLabel,
  type SelectionEvaluation,
} from '@/lib/studio/customization'
export function CustomizationSummary({
  rows,
}: {
  rows: ReadonlyArray<SelectionEvaluation>
}) {
  if (!rows.length) return null
  return (
    <ul
      aria-label="Personnalisation demandée"
      className="mt-3 space-y-2 text-xs text-[color:var(--ink-soft)]"
    >
      {rows.map((row) => (
        <li
          key={`${row.target.key}:${row.selection.kind}`}
          data-status={row.status}
        >
          {selectionLabel(row)}
        </li>
      ))}
    </ul>
  )
}
