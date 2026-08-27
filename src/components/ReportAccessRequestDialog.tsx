import { useState } from 'react'
import { LockKeyhole, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { validateSirenFormat } from '@/lib/validation/siret'

// Demande d'accès aux rapports de tests : les PDF SGS ne sont pas en accès
// libre (décision Adrien 08/2026) — le pro s'identifie (prénom, nom, email,
// téléphone, SIREN), l'admin valide, l'accès est rattaché à l'email.

const inputClass =
  'h-10 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]'

export function ReportAccessRequestDialog({
  open,
  onOpenChange,
  initialEmail,
  onSubmitted,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Email du compte connecté, pré-rempli pour éviter les mismatchs. */
  readonly initialEmail?: string
  readonly onSubmitted?: (status: 'pending' | 'approved') => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [phone, setPhone] = useState('')
  const [siren, setSiren] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Nom et prénom requis')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Email professionnel requis')
      return
    }
    if (phone.trim().length < 6) {
      toast.error('Numéro de téléphone requis')
      return
    }
    const sirenCheck = validateSirenFormat(siren)
    if (!sirenCheck.valid) {
      toast.error('SIREN à vérifier', { description: sirenCheck.reason })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/report-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          siren: sirenCheck.cleaned,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        status?: 'pending' | 'approved'
        error?: string
      } | null

      if (!response.ok || payload?.ok !== true) {
        toast.error('Demande non envoyée', {
          description:
            payload?.error ??
            'Réessayez dans un instant, ou écrivez-nous à adrienlaniez1@gmail.com.',
        })
        return
      }

      const status = payload.status ?? 'pending'
      if (status === 'approved') {
        toast.success('Votre accès est déjà validé', {
          description: `Connectez-vous avec ${email.trim()} pour consulter les rapports.`,
        })
      } else {
        toast.success('Demande envoyée', {
          description:
            'Validation par notre équipe sous 24 h ouvrées — vous recevrez un email de confirmation.',
        })
      }
      onSubmitted?.(status)
      onOpenChange(false)
    } catch {
      toast.error('Demande non envoyée', {
        description:
          'Connexion impossible. Écrivez-nous à adrienlaniez1@gmail.com.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-md border-[color:var(--sand-deep)] sm:max-w-md">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-lg tracking-tight">
            <LockKeyhole className="h-4 w-4 text-[color:var(--ember)]" />
            Accéder aux rapports de tests
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Les rapports complets (SGS, essais EN 581 / EN 1022, analyses
            matériaux) sont réservés aux professionnels identifiés. Votre
            demande est validée par notre équipe sous 24 h ouvrées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Input
              className={inputClass}
              value={firstName}
              placeholder="Prénom *"
              autoComplete="given-name"
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              className={inputClass}
              value={lastName}
              placeholder="Nom *"
              autoComplete="family-name"
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <Input
            className={inputClass}
            type="email"
            value={email}
            placeholder="Email professionnel *"
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Input
              className={inputClass}
              type="tel"
              value={phone}
              placeholder="Téléphone *"
              autoComplete="tel"
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              className={inputClass}
              inputMode="numeric"
              value={siren}
              placeholder="SIREN (9 chiffres) *"
              onChange={(e) => setSiren(e.target.value)}
            />
          </div>

          <p className="text-[11px] leading-4 text-muted-foreground">
            L&apos;accès est rattaché à votre email : après validation,
            connectez-vous avec cette même adresse pour télécharger les
            rapports. Ces informations servent uniquement à vérifier votre
            statut de professionnel.
          </p>

          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="h-11 w-full gap-2 rounded-sm bg-foreground text-background"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Envoi…' : "Demander l'accès"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
