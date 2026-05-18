import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type HTMLInputTypeAttribute,
  type InputHTMLAttributes,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  CreditCard,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { EmailDomainWarning } from '@/components/security/EmailDomainWarning'
import {
  SiretInput,
  type SiretInputState,
} from '@/components/security/SiretInput'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useSiretVerification } from '@/hooks/useSiretVerification'
import { toast } from 'sonner'
import { formatEUR, type OrderTotals } from '@/lib/order'
import {
  applyReferralCode,
  type ReferralApplication,
} from '@/lib/pricing/referral'
import { MOCK_REFERRAL_CODES } from '@/lib/referrals'
import { checkEmailDomain } from '@/lib/validation/email'

type ReservationStep = 1 | 2 | 3 | 4
type DeliveryMode =
  | 'pickup_at_port'
  | 'self_arranged'
  | 'partner_carrier_needed'

const DELIVERY_OPTIONS: ReadonlyArray<{
  value: DeliveryMode
  title: string
  description: string
}> = [
  {
    value: 'pickup_at_port',
    title: 'Enlèvement libre au port',
    description:
      'Gratuit. Vous récupérez la marchandise à Marseille-Fos ou au Havre.',
  },
  {
    value: 'self_arranged',
    title: "J'ai déjà mon transporteur",
    description:
      "Nous transmettrons les informations d'arrivée et de dédouanement.",
  },
  {
    value: 'partner_carrier_needed',
    title: 'Me mettre en relation',
    description: 'Nous vous enverrons une liste de transporteurs recommandés.',
  },
] as const

export function ReservationDialog({
  open,
  onOpenChange,
  totals,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  totals: OrderTotals
}) {
  const [step, setStep] = useState<ReservationStep>(1)
  const [siretCheck, setSiretCheck] = useState<SiretInputState>({
    status: 'idle',
  })
  const [emailWarningAccepted, setEmailWarningAccepted] = useState(false)
  const [cgvAccepted, setCgvAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const siretVerification = useSiretVerification()
  const [form, setForm] = useState({
    siret: '',
    name: '',
    company: '',
    email: '',
    phone: '',
    referralCode: '',
    deliveryMode: 'pickup_at_port' as DeliveryMode,
    deliveryNote: '',
  })

  const emailCheck = useMemo(() => checkEmailDomain(form.email), [form.email])
  const referralApplication = useMemo(
    () =>
      applyReferralCode({
        codeInput: form.referralCode,
        reservationFee: totals.reservationFee,
        codes: MOCK_REFERRAL_CODES,
        referredSiret: form.siret,
        referredEmail: form.email,
      }),
    [form.email, form.referralCode, form.siret, totals.reservationFee],
  )
  const checkoutPayNow = referralApplication.payNow
  const contactValid =
    form.name.trim().length > 1 &&
    form.company.trim().length > 1 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 6 &&
    (!emailCheck.showWarning || emailWarningAccepted)
  const deliveryValid = form.deliveryMode.length > 0
  const siretCanContinue =
    siretCheck.status === 'verified' ||
    siretCheck.status === 'verification_unavailable'

  const reset = () => {
    setStep(1)
    setSiretCheck({ status: 'idle' })
    setEmailWarningAccepted(false)
    setCgvAccepted(false)
    setSubmitting(false)
  }

  useEffect(() => {
    if (!open || typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const refFromUrl = params.get('ref')
    const storedRef = window.localStorage.getItem('container-club-ref-code')
    const nextRef = refFromUrl ?? storedRef

    if (refFromUrl) {
      window.localStorage.setItem('container-club-ref-code', refFromUrl)
    }

    if (nextRef) {
      setForm((previous) =>
        previous.referralCode
          ? previous
          : { ...previous, referralCode: nextRef },
      )
    }
  }, [open])

  const handlePay = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      onOpenChange(false)
      reset()
      toast.success('Réservation enregistrée', {
        description: `Confirmation envoyée à ${form.email}. Paiement Stripe à connecter pour ${formatEUR(checkoutPayNow)}.`,
      })
    }, 900)
  }

  const goBack = () =>
    setStep((current) => Math.max(1, current - 1) as ReservationStep)

  const verifySiret = useCallback(
    async (cleanedSiret: string): Promise<SiretInputState> => {
      const result = await siretVerification.verify(cleanedSiret)

      if (result.status === 'verified') {
        setForm((previous) => ({
          ...previous,
          siret: cleanedSiret,
          company: previous.company || result.data.legal_name,
        }))

        return {
          status: 'verified',
          siret: cleanedSiret,
          legalName: result.data.legal_name,
        }
      }

      if (result.status === 'verification_unavailable') {
        return {
          status: 'verification_unavailable',
          siret: cleanedSiret,
          reason: result.reason,
        }
      }

      if (result.status === 'invalid_format') {
        return {
          status: 'invalid',
          reason: result.reason,
        }
      }

      return {
        status: result.status,
        reason: result.reason,
      }
    },
    [siretVerification],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) reset()
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[color:var(--sand-soft)] sm:max-w-2xl">
        <DialogHeader>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Étape {step} / 4 - Réservation
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {step === 1 && 'Identification professionnelle'}
            {step === 2 && 'Coordonnées de contact'}
            {step === 3 && 'Mode de livraison'}
            {step === 4 && 'Récapitulatif et paiement'}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} />
        <SummaryCard
          totals={totals}
          referralApplication={referralApplication}
        />

        {step === 1 && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (siretCanContinue) setStep(2)
            }}
          >
            <SiretInput
              value={form.siret}
              state={siretCheck}
              onValueChange={(value) => setForm({ ...form, siret: value })}
              onStateChange={setSiretCheck}
              onVerified={(cleanedSiret) =>
                setForm((previous) => ({ ...previous, siret: cleanedSiret }))
              }
              onVerify={verifySiret}
            />

            <Button
              type="submit"
              disabled={!siretCanContinue}
              className="h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              Continuer
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {step === 2 && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (contactValid) setStep(3)
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Nom complet *"
                id="name"
                autoComplete="name"
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <Field
                label="Société / établissement *"
                id="company"
                autoComplete="organization"
                value={form.company}
                onChange={(value) => setForm({ ...form, company: value })}
              />
              <Field
                label="Email pro *"
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(value) => {
                  setForm({ ...form, email: value })
                  setEmailWarningAccepted(false)
                }}
              />
              <Field
                label="Téléphone *"
                id="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(value) => setForm({ ...form, phone: value })}
              />
            </div>

            <EmailDomainWarning
              email={form.email}
              accepted={emailWarningAccepted}
              onAccept={() => setEmailWarningAccepted(true)}
              onEdit={() => {
                setForm({ ...form, email: '' })
                setEmailWarningAccepted(false)
              }}
            />

            <DialogActions onBack={goBack} nextDisabled={!contactValid} />
          </form>
        )}

        {step === 3 && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (deliveryValid) setStep(4)
            }}
          >
            <RadioGroup
              value={form.deliveryMode}
              onValueChange={(value) =>
                setForm({ ...form, deliveryMode: value as DeliveryMode })
              }
              className="gap-2"
            >
              {DELIVERY_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  className="hover:border-foreground/40 flex cursor-pointer items-start gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-sm transition-colors"
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            <Field
              label="Note optionnelle"
              id="deliveryNote"
              value={form.deliveryNote}
              onChange={(value) => setForm({ ...form, deliveryNote: value })}
              hint="Ex : transporteur habituel, contraintes d'enlèvement, contact logistique."
            />

            <StatusBox
              tone="info"
              title="Aucune facturation transport en V1"
              text="Container Club facture uniquement le prix rendu port. Le transport post-port est organisé et payé directement par le client."
            />

            <DialogActions onBack={goBack} nextDisabled={!deliveryValid} />
          </form>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <ReferralCodePanel
              value={form.referralCode}
              application={referralApplication}
              onChange={(value) => setForm({ ...form, referralCode: value })}
            />

            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">Carte bancaire</span>
                <span className="label-eyebrow ml-auto text-muted-foreground">
                  Powered by Stripe
                </span>
              </div>
              <div className="space-y-2">
                <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-muted-foreground">
                  4242 4242 4242 4242
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-muted-foreground">
                    MM / AA
                  </div>
                  <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-muted-foreground">
                    CVC
                  </div>
                </div>
              </div>
              <div className="text-foreground/75 mt-3 rounded-sm bg-[color:var(--sand)] px-3 py-2 text-[11px]">
                Vous serez débité aujourd'hui de{' '}
                <strong className="font-semibold">
                  {formatEUR(checkoutPayNow)}
                </strong>{' '}
                (frais de réservation non-remboursables sauf annulation
                Container Club).
              </div>
            </div>

            <Label className="flex items-start gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs leading-5">
              <Checkbox
                checked={cgvAccepted}
                onCheckedChange={(checked) => setCgvAccepted(checked === true)}
                className="mt-0.5"
              />
              <span>
                J'accepte les CGV B2B, dont la clause SIRET obligatoire et les
                conditions de frais de réservation.
              </span>
            </Label>

            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <Reassure
                Icon={Lock}
                t="Paiement sécurisé par Stripe - 3D Secure"
              />
              <Reassure
                Icon={Mail}
                t="Magic link envoyé après paiement réussi"
              />
              <Reassure
                Icon={RefreshCcw}
                t="Frais remboursés à 100% si Container Club annule le container"
              />
              <Reassure
                Icon={ShieldCheck}
                t="Importation officielle - garantie 2 ans"
              />
              <Reassure
                Icon={Truck}
                t="Transport post-port non facturé par Container Club"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-sm border-[color:var(--sand-deep)] sm:w-auto"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
                onClick={handlePay}
                disabled={submitting || !cgvAccepted}
              >
                {submitting
                  ? 'Traitement...'
                  : `Confirmer et payer ${formatEUR(checkoutPayNow)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({
  totals,
  referralApplication,
}: {
  totals: OrderTotals
  referralApplication: ReferralApplication
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Total commande HT
          </div>
          <div className="mt-0.5 font-display text-lg font-semibold tabular-nums">
            {formatEUR(totals.subtotalHt)}
          </div>
        </div>
        <div>
          <div className="label-eyebrow text-muted-foreground">Économie</div>
          <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[color:var(--ember)]">
            -{formatEUR(totals.savings)}
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-[color:var(--sand-deep)] pt-3">
        <div className="mb-2 space-y-1 text-[11px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Frais de réservation</span>
            <span className="tabular-nums">
              {formatEUR(totals.reservationFee)}
            </span>
          </div>
          {referralApplication.status === 'applied' && (
            <div className="flex justify-between text-[color:var(--forest)]">
              <span>Code parrainage</span>
              <span className="tabular-nums">
                -{formatEUR(referralApplication.discountAmount)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-foreground/80 text-xs">
            À payer aujourd'hui
          </span>
          <span className="font-display text-2xl font-semibold tabular-nums">
            {formatEUR(referralApplication.payNow)}
          </span>
        </div>
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Acompte 27% à 80% remplissage</span>
            <span className="tabular-nums">
              {formatEUR(totals.payAt80Percent)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Solde 70% avant expédition</span>
            <span className="tabular-nums">
              {formatEUR(totals.payBeforeShipping)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReferralCodePanel({
  value,
  application,
  onChange,
}: {
  value: string
  application: ReferralApplication
  onChange: (value: string) => void
}) {
  const applied = application.status === 'applied'
  const hasFeedback = application.status !== 'none'
  const feedbackTone = applied
    ? 'border-[color:var(--forest)]/25 bg-[color:var(--forest)]/10 text-[color:var(--forest)]'
    : 'border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80'

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <BadgePercent className="h-4 w-4" />
        <span className="text-sm font-medium">Code parrainage</span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Optionnel
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={value}
          placeholder="CONTAINER-PIERRE-X7K9-2026"
          onChange={(event) => onChange(event.target.value)}
          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] font-mono text-xs uppercase focus-visible:border-foreground focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-sm border-[color:var(--sand-deep)]"
          onClick={() => onChange('')}
          disabled={!value}
        >
          Effacer
        </Button>
      </div>
      {hasFeedback ? (
        <div
          className={`mt-3 rounded-sm border px-3 py-2 text-xs ${feedbackTone}`}
        >
          <div className="font-medium">
            {applied ? 'Parrainage appliqué' : 'Code non appliqué'}
          </div>
          <div className="mt-1 leading-5">
            {application.message}
            {applied && application.referrerLabel
              ? ` ${application.referrerLabel} recevra son credit apres validation de la reservation.`
              : ''}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Le filleul reçoit jusqu'à 100€ de réduction sur les frais de
          réservation.
        </p>
      )}
    </div>
  )
}

function StepIndicator({ step }: { step: ReservationStep }) {
  const labels = ['SIRET', 'Contact', 'Livraison', 'Paiement']

  return (
    <div className="grid grid-cols-4 gap-1 text-[10px]">
      {labels.map((label, index) => {
        const current = index + 1
        const active = current === step
        const done = current < step

        return (
          <div
            key={label}
            className={`rounded-sm border px-2 py-1.5 text-center ${
              active || done
                ? 'border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]'
                : 'border-[color:var(--sand-deep)] bg-card text-muted-foreground'
            }`}
          >
            {label}
            {done && ' ✓'}
          </div>
        )
      })}
    </div>
  )
}

function DialogActions({
  onBack,
  nextDisabled,
}: {
  onBack: () => void
  nextDisabled: boolean
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-sm border-[color:var(--sand-deep)] sm:w-auto"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>
      <Button
        type="submit"
        disabled={nextDisabled}
        className="h-11 flex-1 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
      >
        Continuer
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function Field({
  label,
  id,
  value,
  onChange,
  type = 'text',
  hint,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  type?: HTMLInputTypeAttribute
  hint?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <ValidatedInput
      id={id}
      label={label}
      value={value}
      onValueChange={onChange}
      type={type}
      hint={hint}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
    />
  )
}

function StatusBox({
  tone,
  title,
  text,
}: {
  tone: 'error' | 'info'
  title: string
  text: string
}) {
  const classes =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-[color:var(--sand-deep)] bg-[color:var(--sand)] text-foreground/80'

  return (
    <div className={`rounded-md border p-3 text-xs ${classes}`}>
      <div className="font-medium">{title}</div>
      <div className="mt-1 leading-5">{text}</div>
    </div>
  )
}

function Reassure({ Icon, t }: { Icon: typeof Lock; t: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="text-foreground/50 h-3 w-3" strokeWidth={1.5} />
      <span className="min-w-0 leading-4">{t}</span>
    </div>
  )
}
