import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

/**
 * Live "closes in Xd Xh" urgency badge for the active container.
 *
 * Renders nothing on the server and on the first client paint (label starts
 * null, set inside an effect) so there is no SSR/client hydration mismatch from
 * the moving clock. Updates every minute.
 */
export function CountdownBadge({
  target,
  className,
  withIcon = true,
}: {
  readonly target: string | null
  readonly className?: string
  readonly withIcon?: boolean
}) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!target) {
      setLabel(null)
      return
    }
    const targetMs = new Date(target).getTime()
    if (Number.isNaN(targetMs)) {
      setLabel(null)
      return
    }

    const compute = () => {
      const diff = targetMs - Date.now()
      if (diff <= 0) {
        setLabel('Cloture imminente'.replace('Cloture', 'Clôture'))
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const minutes = Math.floor((diff % 3_600_000) / 60_000)
      const prefix = 'Clôture dans'
      setLabel(
        days >= 1
          ? `${prefix} ${days}j ${hours}h`
          : `${prefix} ${hours}h ${minutes}min`,
      )
    }

    compute()
    const id = setInterval(compute, 60_000)
    return () => clearInterval(id)
  }, [target])

  if (!target || !label) return null

  return (
    <span
      className={
        className ??
        'border-[color:var(--ember)]/30 bg-[color:var(--ember)]/10 inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium text-[color:var(--ember)]'
      }
    >
      {withIcon && <Clock className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
