import { CheckCircle2, Clock3, LockKeyhole, Radio } from 'lucide-react'

type ContainerStatus = 'open' | 'threshold_reached' | 'closed' | 'production'

const STATUS_COPY: Record<
  ContainerStatus,
  {
    label: string
    icon: typeof Radio
    className: string
  }
> = {
  open: {
    label: 'Ouvert',
    icon: Radio,
    className: 'bg-[color:var(--forest)]/10 text-[color:var(--forest)]',
  },
  threshold_reached: {
    label: 'Seuil atteint',
    icon: CheckCircle2,
    className: 'bg-[color:var(--ember)]/10 text-[color:var(--ember)]',
  },
  closed: {
    label: 'Clôturé',
    icon: LockKeyhole,
    className: 'bg-muted text-muted-foreground',
  },
  production: {
    label: 'Production',
    icon: Clock3,
    className: 'bg-[color:var(--ochre)]/12 text-[color:var(--ochre)]',
  },
}

export function getContainerDisplayStatus({
  status,
  fillPercent,
  thresholdPercent,
}: {
  status: 'open'
  fillPercent: number
  thresholdPercent: number
}): ContainerStatus {
  if (status === 'open' && fillPercent >= thresholdPercent)
    return 'threshold_reached'
  return status
}

export function ContainerStatusBadge({
  status,
  fillPercent,
  thresholdPercent,
}: {
  status: 'open'
  fillPercent: number
  thresholdPercent: number
}) {
  const displayStatus = getContainerDisplayStatus({
    status,
    fillPercent,
    thresholdPercent,
  })
  const copy = STATUS_COPY[displayStatus]
  const Icon = copy.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium ${copy.className}`}
    >
      <Icon className="h-3 w-3" />
      {copy.label}
    </span>
  )
}
