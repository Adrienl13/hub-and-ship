import { Users } from 'lucide-react'

export function ParticipantsCount({ count }: { count: number }) {
  const visibleAvatars = Math.min(4, Math.max(0, count))

  return (
    <div className="flex items-center justify-between gap-3 rounded-sm bg-[color:var(--sand-soft)] px-3 py-2 text-xs">
      <div>
        <div className="label-eyebrow text-muted-foreground">Participants</div>
        <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
          {count} pros engagés
        </div>
      </div>
      <div className="flex items-center">
        {Array.from({ length: visibleAvatars }).map((_, index) => (
          <span
            key={index}
            className="-ml-1 grid h-7 w-7 place-items-center rounded-full border border-card bg-[color:var(--sand)] text-[color:var(--ink-soft)] first:ml-0"
          >
            <Users className="h-3.5 w-3.5" />
          </span>
        ))}
      </div>
    </div>
  )
}
