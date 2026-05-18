import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react'

export type SiretVerificationDisplayState =
  | { readonly status: 'idle' }
  | { readonly status: 'checking' }
  | { readonly status: 'invalid'; readonly reason: string }
  | { readonly status: 'not_found'; readonly reason: string }
  | { readonly status: 'inactive'; readonly reason: string }
  | { readonly status: 'duplicate'; readonly reason: string }
  | {
      readonly status: 'verification_unavailable'
      readonly reason: string
      readonly siret?: string
    }
  | {
      readonly status: 'verified'
      readonly siret: string
      readonly legalName?: string
    }

const DISPLAY_COPY: Record<
  Exclude<SiretVerificationDisplayState['status'], 'idle'>,
  {
    readonly title: string
    readonly className: string
    readonly Icon: typeof CheckCircle2
  }
> = {
  checking: {
    title: 'Vérification en cours',
    className:
      'border-[color:var(--sand-deep)] bg-[color:var(--sand)] text-foreground/80',
    Icon: Loader2,
  },
  invalid: {
    title: 'SIRET non valide',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
  not_found: {
    title: 'SIRET introuvable',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
  inactive: {
    title: 'Établissement fermé',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
    Icon: XCircle,
  },
  duplicate: {
    title: 'Compte existant détecté',
    className:
      'border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80',
    Icon: AlertTriangle,
  },
  verification_unavailable: {
    title: 'Vérification temporairement indisponible',
    className:
      'border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80',
    Icon: Info,
  },
  verified: {
    title: 'SIRET vérifié',
    className:
      'border-[color:var(--forest)]/25 bg-[color:var(--forest)]/10 text-[color:var(--forest)]',
    Icon: CheckCircle2,
  },
}

export function SiretVerificationDisplay({
  state,
}: {
  readonly state: SiretVerificationDisplayState
}) {
  if (state.status === 'idle') return null

  const copy = DISPLAY_COPY[state.status]
  const Icon = copy.Icon
  const message =
    state.status === 'verified'
      ? `${state.siret}${state.legalName ? ` - ${state.legalName}` : ''} - contrôle INSEE complet.`
      : state.status === 'checking'
        ? 'Nous interrogeons la vérification INSEE sécurisée.'
        : state.reason

  return (
    <div className={`rounded-md border p-4 text-sm ${copy.className}`}>
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-0.5 h-4 w-4 ${state.status === 'checking' ? 'animate-spin' : ''}`}
        />
        <div>
          <div className="font-medium">{copy.title}</div>
          <div className="text-current/80 mt-1 text-xs leading-5">
            {message}
          </div>
        </div>
      </div>
    </div>
  )
}
