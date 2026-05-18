import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { validateSiretFormat } from '@/lib/validation/siret'
import {
  SiretVerificationDisplay,
  type SiretVerificationDisplayState,
} from './SiretVerificationDisplay'
import { ValidatedInput } from './ValidatedInput'

export type SiretInputState = SiretVerificationDisplayState

export function SiretInput({
  value,
  state,
  onValueChange,
  onStateChange,
  onVerified,
  onVerify,
}: {
  readonly value: string
  readonly state: SiretInputState
  readonly onValueChange: (value: string) => void
  readonly onStateChange: (state: SiretInputState) => void
  readonly onVerified: (cleanedSiret: string) => void
  readonly onVerify?: (cleanedSiret: string) => Promise<SiretInputState>
}) {
  const handleChange = (nextValue: string) => {
    onValueChange(nextValue)
    onStateChange({ status: 'idle' })
  }

  const handleVerify = async () => {
    const result = validateSiretFormat(value)

    if (!result.valid) {
      onStateChange({
        status: 'invalid',
        reason: result.reason ?? 'SIRET invalide',
      })
      return
    }

    onValueChange(result.cleaned)
    onStateChange({ status: 'checking' })

    const nextState = onVerify
      ? await onVerify(result.cleaned)
      : { status: 'verified' as const, siret: result.cleaned }

    onStateChange(nextState)

    if (
      nextState.status === 'verified' ||
      nextState.status === 'verification_unavailable'
    ) {
      onVerified(result.cleaned)
    }
  }

  return (
    <div className="space-y-4">
      <ValidatedInput
        label="Numéro SIRET"
        id="siret"
        value={value}
        inputMode="numeric"
        autoComplete="off"
        placeholder="732 829 320 00074"
        onValueChange={handleChange}
        hint="Le SIRET de l'établissement de facturation. Vérification INSEE sécurisée avant réservation."
        required
      />
      <SiretVerificationDisplay state={state} />
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-sm border-[color:var(--sand-deep)] sm:w-auto"
        onClick={handleVerify}
        disabled={state.status === 'checking'}
      >
        <Search className="h-4 w-4" />
        Vérifier mon SIRET
      </Button>
    </div>
  )
}
