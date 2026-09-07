import { Undo2 } from 'lucide-react'

export function UndoButton({
  onUndo,
  canUndo,
  label = 'Annuler la dernière action',
}: {
  readonly onUndo: () => void
  readonly canUndo: boolean
  readonly label?: string
}) {
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={!canUndo}
      aria-label={label}
      aria-keyshortcuts="z"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] px-4 text-sm font-medium text-[color:var(--ink)] transition-colors hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Undo2 className="h-4 w-4" aria-hidden />
      Annuler
    </button>
  )
}
