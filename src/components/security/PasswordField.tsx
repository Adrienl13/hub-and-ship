import { useState, type ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface PasswordFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly autoComplete: 'current-password' | 'new-password'
  readonly error?: string
  readonly hint?: string
  readonly required?: boolean
  /** Indicateur de solidité, affiché sous le champ (inscription, changement). */
  readonly strength?: 'faible' | 'correct' | 'solide'
  /** Contenu aligné à droite sous le champ (ex. « Mot de passe oublié ? »). */
  readonly trailing?: ReactNode
}

const STRENGTH_LABEL = {
  faible: 'Mot de passe faible',
  correct: 'Mot de passe correct',
  solide: 'Mot de passe solide',
} as const

const STRENGTH_TONE = {
  faible: 'text-[color:var(--ember)]',
  correct: 'text-foreground',
  solide: 'text-[color:var(--forest)]',
} as const

const STRENGTH_STEPS = { faible: 1, correct: 2, solide: 3 } as const

/**
 * Champ mot de passe du tunnel de connexion : bouton « Afficher »/« Masquer »
 * (le masquage est une gêne fréquente sur mobile), message d'erreur relié au
 * champ pour les lecteurs d'écran, indicateur de solidité facultatif.
 */
export function PasswordField({
  id,
  label,
  value,
  onValueChange,
  autoComplete,
  error,
  hint,
  required,
  strength,
  trailing,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const messageId = `${id}-message`
  const strengthId = `${id}-strength`
  const describedBy =
    [error || hint ? messageId : null, strength && value ? strengthId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="flex items-stretch">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(event.target.value)}
          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label="Afficher le mot de passe"
          title={
            visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
          }
          onClick={() => setVisible((current) => !current)}
          className="h-10 shrink-0 border border-l-0 border-[color:var(--sand-deep)] bg-card px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {error && (
        <p id={messageId} className="text-[10px] leading-4 text-destructive">
          {error}
        </p>
      )}
      {!error && hint && (
        <p
          id={messageId}
          className="text-[10px] leading-4 text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {strength && value && (
        <div
          id={strengthId}
          className="flex items-center gap-2 pt-1"
          aria-live="polite"
        >
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={
                  'h-1 flex-1 rounded-full ' +
                  (step <= STRENGTH_STEPS[strength]
                    ? strength === 'faible'
                      ? 'bg-[color:var(--ember)]'
                      : strength === 'correct'
                        ? 'bg-[color:var(--foreground)]'
                        : 'bg-[color:var(--forest)]'
                    : 'bg-[color:var(--sand-deep)]')
                }
              />
            ))}
          </div>
          <span className={`text-[10px] leading-4 ${STRENGTH_TONE[strength]}`}>
            {STRENGTH_LABEL[strength]}
          </span>
        </div>
      )}
      {trailing && <div className="flex justify-end pt-1">{trailing}</div>}
    </div>
  )
}
