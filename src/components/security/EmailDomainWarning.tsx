import { Button } from '@/components/ui/button'
import { checkEmailDomain } from '@/lib/validation/email'

export function EmailDomainWarning({
  email,
  accepted,
  onAccept,
  onEdit,
}: {
  readonly email: string
  readonly accepted: boolean
  readonly onAccept: () => void
  readonly onEdit: () => void
}) {
  const check = checkEmailDomain(email)

  if (!check.showWarning) return null

  if (accepted) {
    return (
      <div className="border-[color:var(--forest)]/25 bg-[color:var(--forest)]/10 rounded-md border p-3 text-xs text-[color:var(--forest)]">
        <div className="font-medium">Adresse personnelle acceptée</div>
        <p className="mt-1 leading-5">
          Le domaine {check.domain} est toléré pour continuer, avec une revue
          possible côté admin.
        </p>
      </div>
    )
  }

  return (
    <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80 rounded-md border p-3 text-xs">
      <div className="font-medium text-[color:var(--ochre)]">
        Adresse personnelle détectée
      </div>
      <p className="mt-1 leading-5">{check.warningMessage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-sm"
          onClick={onAccept}
        >
          Je comprends, continuer
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-sm border-[color:var(--sand-deep)]"
          onClick={onEdit}
        >
          Modifier mon email
        </Button>
      </div>
    </div>
  )
}
