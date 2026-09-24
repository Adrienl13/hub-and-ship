import { useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FOLLOW_UP_BODY_MAX,
  FOLLOW_UP_SUBJECT_MAX,
  FOLLOW_UP_TEMPLATE_IDS,
  FOLLOW_UP_TEMPLATES,
  buildFollowUpDraft,
  validateFollowUp,
  type FollowUpContext,
  type FollowUpErrors,
  type FollowUpTargetKind,
  type FollowUpTemplateId,
} from '@/lib/admin/follow-ups'
import {
  sendAdminFollowUp,
  type SendAdminFollowUpResult,
} from '@/lib/admin/follow-ups.send'

// Dialogue « Relancer » du back-office : choix du modèle, sujet et corps
// éditables, aperçu du destinataire, envoi via la fonction serveur (qui
// vérifie l'admin, envoie l'email et trace la relance). Le parent fournit la
// cible et son contexte ; il est prévenu par `onSent` une fois l'email parti.

export interface FollowUpTarget {
  readonly kind: FollowUpTargetKind
  readonly id: string
  readonly recipientName: string
  readonly recipientEmail: string
  readonly context: FollowUpContext
  readonly defaultTemplate?: FollowUpTemplateId
  /** Lien interne facultatif (chemin du site) ajouté en bouton dans l'email. */
  readonly ctaUrl?: string
  readonly ctaLabel?: string
}

export interface FollowUpSent {
  readonly template: FollowUpTemplateId
  readonly subject: string
  readonly traced: boolean
}

export function FollowUpDialog({
  target,
  onClose,
  onSent,
}: {
  readonly target: FollowUpTarget | null
  readonly onClose: () => void
  readonly onSent?: (target: FollowUpTarget, sent: FollowUpSent) => void
}) {
  // Pendant l'envoi, ni Échap ni un clic hors du dialogue ne le ferment :
  // l'admin verrait l'état disparaître et pourrait relancer deux fois.
  const [sending, setSending] = useState(false)
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !sending) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        {target && (
          // Clé sur la cible : le formulaire repart à zéro d'une ligne à l'autre.
          <FollowUpForm
            key={`${target.kind}:${target.id}`}
            target={target}
            onClose={onClose}
            onSent={onSent}
            onSendingChange={setSending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const FAILURE_MESSAGE: Record<
  Extract<SendAdminFollowUpResult, { ok: false }>['reason'],
  string
> = {
  forbidden: 'Session admin requise : reconnectez-vous puis réessayez.',
  target_not_found: 'Cette demande n’existe plus : rafraîchissez la liste.',
  recipient_mismatch:
    'L’adresse ne correspond pas à celle de la demande : rafraîchissez la liste.',
  email_failed: "L'envoi a été refusé par le service d'email.",
  not_configured: "Le service d'email n'est pas configuré sur ce serveur.",
}

function FollowUpForm({
  target,
  onClose,
  onSent,
  onSendingChange,
}: {
  readonly target: FollowUpTarget
  readonly onClose: () => void
  readonly onSent?: (target: FollowUpTarget, sent: FollowUpSent) => void
  readonly onSendingChange: (sending: boolean) => void
}) {
  const initialTemplate = target.defaultTemplate ?? 'informations'
  const [template, setTemplate] = useState<FollowUpTemplateId>(initialTemplate)
  const [draft, setDraft] = useState(() =>
    buildFollowUpDraft(initialTemplate, target.context),
  )
  const [errors, setErrors] = useState<FollowUpErrors>({})
  const [sending, setSending] = useState(false)

  function chooseTemplate(next: FollowUpTemplateId): void {
    setTemplate(next)
    setDraft(buildFollowUpDraft(next, target.context))
    setErrors({})
  }

  async function submit(): Promise<void> {
    const validation = validateFollowUp({
      subject: draft.subject,
      body: draft.body,
      email: target.recipientEmail,
    })
    if (!validation.ok) {
      setErrors(validation.errors)
      return
    }
    setErrors({})
    setSending(true)
    onSendingChange(true)
    try {
      const result = await sendAdminFollowUp({
        data: {
          targetKind: target.kind,
          targetId: target.id,
          recipientEmail: validation.value.email,
          ...(target.recipientName.trim()
            ? { recipientName: target.recipientName.trim() }
            : {}),
          subject: validation.value.subject,
          body: validation.value.body,
          template,
          ...(target.context.reference
            ? { reference: target.context.reference }
            : {}),
          ...(target.ctaUrl ? { ctaUrl: target.ctaUrl } : {}),
          ...(target.ctaLabel ? { ctaLabel: target.ctaLabel } : {}),
        },
      })
      if (!result.ok) {
        toast.error('Relance non envoyée', {
          description: FAILURE_MESSAGE[result.reason],
        })
        setSending(false)
        onSendingChange(false)
        return
      }
      if (result.traced) {
        toast.success('Relance envoyée', {
          description: `À ${validation.value.email}`,
        })
      } else {
        toast.warning('Relance envoyée mais non tracée', {
          description:
            "L'email est parti ; la trace n'a pas pu être enregistrée.",
        })
      }
      onSent?.(target, {
        template,
        subject: validation.value.subject,
        traced: result.traced,
      })
      onClose()
    } catch (error) {
      toast.error('Relance non envoyée', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      })
      setSending(false)
      onSendingChange(false)
    }
  }

  const recipientLine = target.recipientName.trim()
    ? `${target.recipientName.trim()} <${target.recipientEmail}>`
    : target.recipientEmail

  return (
    <>
      <DialogHeader>
        <DialogTitle>Relancer</DialogTitle>
        <DialogDescription>
          Email envoyé au nom de Terrassea ; les réponses arrivent sur la boîte
          admin. Chaque relance est tracée.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-xs">
          <span className="text-muted-foreground">Destinataire : </span>
          <span className="font-medium" data-testid="follow-up-recipient">
            {recipientLine}
          </span>
          {target.context.company && (
            <span className="text-muted-foreground">
              {' · '}
              {target.context.company}
            </span>
          )}
          {errors.email && (
            <div className="mt-1 text-red-700">{errors.email}</div>
          )}
        </div>

        <fieldset>
          <legend className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Modèle
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {FOLLOW_UP_TEMPLATE_IDS.map((id) => {
              const active = template === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  disabled={sending}
                  title={FOLLOW_UP_TEMPLATES[id].description}
                  onClick={() => chooseTemplate(id)}
                  className={`rounded-sm border px-2 py-1 text-xs transition ${
                    active
                      ? 'border-foreground bg-card font-medium'
                      : 'hover:border-foreground/40 border-[color:var(--sand-deep)] bg-card text-muted-foreground'
                  }`}
                >
                  {FOLLOW_UP_TEMPLATES[id].label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Changer de modèle remplace le sujet et le message.
          </p>
        </fieldset>

        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Sujet
          <Input
            value={draft.subject}
            maxLength={FOLLOW_UP_SUBJECT_MAX}
            disabled={sending}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                subject: event.target.value,
              }))
            }
            className="mt-1 h-9 text-sm font-normal normal-case tracking-normal"
            aria-invalid={Boolean(errors.subject)}
          />
        </label>
        {errors.subject && (
          <p className="-mt-2 text-xs text-red-700">{errors.subject}</p>
        )}

        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Message
          <Textarea
            value={draft.body}
            rows={9}
            maxLength={FOLLOW_UP_BODY_MAX}
            disabled={sending}
            placeholder="Le message commence par « Bonjour … » et se termine par la signature Terrassea : écrivez seulement le corps."
            onChange={(event) =>
              setDraft((current) => ({ ...current, body: event.target.value }))
            }
            className="mt-1 text-sm font-normal normal-case tracking-normal"
            aria-invalid={Boolean(errors.body)}
          />
        </label>
        <div className="-mt-2 flex items-start justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="text-red-700">{errors.body ?? ''}</span>
          <span className="tabular-nums">
            {draft.body.trim().length} / {FOLLOW_UP_BODY_MAX}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={sending}
          onClick={onClose}
        >
          Annuler
        </Button>
        <Button
          type="button"
          disabled={sending}
          onClick={() => void submit()}
          className="gap-1.5"
        >
          <Send className="h-4 w-4" />
          {sending ? 'Envoi…' : 'Envoyer la relance'}
        </Button>
      </DialogFooter>
    </>
  )
}
