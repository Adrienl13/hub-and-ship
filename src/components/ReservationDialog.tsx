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
  Handshake,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { sendReservationConfirmation } from '@/lib/email/reservation-confirmation'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { AnalyticsEvent, track } from '@/lib/analytics'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PaymentTrustBadges } from '@/components/PaymentTrustBadges'
import { EmailDomainWarning } from '@/components/security/EmailDomainWarning'
import {
  SiretInput,
  type SiretInputState,
} from '@/components/security/SiretInput'
import { ValidatedInput } from '@/components/security/ValidatedInput'
import { useReservationCreation } from '@/hooks/useReservationCreation'
import { useSiretVerification } from '@/hooks/useSiretVerification'
import { toast } from 'sonner'
import { formatEUR, type CartItem, type OrderTotals } from '@/lib/order'
import {
  normalizeReferralCode,
  type ReferralApplication,
  type ReferralApplicationStatus,
} from '@/lib/pricing/referral'
import {
  readPartnerLinkContext,
  type PartnerLinkContext,
} from '@/lib/partners/link'
import {
  previewReferralCode,
  type ReferralPreviewClient,
} from '@/lib/referrals/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { buildReservationDraft } from '@/lib/reservations/draft'
import { CURRENT_CONTAINER, type ContainerSummary } from '@/lib/products'
import { useCartStore } from '@/stores/cart.store'
import { checkEmailDomain } from '@/lib/validation/email'

type ReservationStep = 1 | 2 | 3 | 4 | 5
type DeliveryMode =
  | 'pickup_at_port'
  | 'self_arranged'
  | 'partner_carrier_needed'

interface StoredConfirmationItem {
  readonly productId: string
  readonly productName: string
  readonly variantName: string
  readonly quantity: number
  readonly subtotalHt: number
}

interface StoredConfirmation {
  readonly reservationId: string
  readonly reference: string
  readonly contact: {
    readonly name: string
    readonly company: string
    readonly email: string
    readonly phone: string
  }
  readonly containerReference: string
  readonly createdAt: string
  readonly payNow: number
  readonly items: ReadonlyArray<StoredConfirmationItem>
  readonly totals: {
    readonly subtotalHt: number
    readonly vat: number
    readonly totalTtc: number
  }
}

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

function referralMessage(
  status: ReferralApplicationStatus,
  referrerLabel?: string,
): string {
  switch (status) {
    case 'applied':
      return referrerLabel
        ? `${referrerLabel} vous parraine : remise appliquée sur les frais de réservation.`
        : 'Code parrainage appliqué : remise sur les frais de réservation.'
    case 'unknown':
      return 'Code parrainage introuvable.'
    case 'inactive':
      return 'Ce code parrainage est désactivé.'
    case 'expired':
      return 'Ce code parrainage a expiré.'
    case 'exhausted':
      return "Ce code a atteint sa limite d'utilisations."
    case 'self_referral':
      return 'Le parrainage ne peut pas être utilisé par la société parrainée.'
    default:
      return ''
  }
}

export function ReservationDialog({
  open,
  onOpenChange,
  items,
  totals,
  container = CURRENT_CONTAINER,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: ReadonlyArray<CartItem>
  totals: OrderTotals
  container?: ContainerSummary
}) {
  const [step, setStep] = useState<ReservationStep>(1)
  const [siretCheck, setSiretCheck] = useState<SiretInputState>({
    status: 'idle',
  })
  const [emailWarningAccepted, setEmailWarningAccepted] = useState(false)
  const [cgvAccepted, setCgvAccepted] = useState(false)
  const [partnerContext, setPartnerContext] =
    useState<PartnerLinkContext | null>(null)
  // Pick up the buyer's container choice (from the sidebar toggle) so
  // we can persist it on the reservation row. NULL when they kept the
  // active default — only distributors carry a value here.
  const requestedContainerType = useCartStore(
    (state) => state.preferredContainerType,
  )
  const [submitting, setSubmitting] = useState(false)
  const [createdReservation, setCreatedReservation] = useState<{
    readonly reference: string
    readonly persisted: boolean
    readonly payNow: number
  } | null>(null)
  const reservationCreation = useReservationCreation()
  const startCheckout = useServerFn(createCheckoutSession)
  const sendConfirmationEmail = useServerFn(sendReservationConfirmation)
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
  const hasReservableItems = items.length > 0 && totals.subtotalHt > 0
  // Referral validation is now server-authoritative: we preview the code via a
  // SECURITY DEFINER RPC (real code, active, not exhausted, not self-referral)
  // and the discount is re-checked + applied at reservation creation.
  const [referralApplication, setReferralApplication] =
    useState<ReferralApplication>({
      status: 'none',
      code: '',
      discountAmount: 0,
      payNow: totals.reservationFee,
      message: '',
    })

  useEffect(() => {
    const fee = Math.max(0, totals.reservationFee)
    const raw = form.referralCode.trim()
    if (!raw) {
      setReferralApplication({
        status: 'none',
        code: '',
        discountAmount: 0,
        payNow: fee,
        message: '',
      })
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const client = createSupabaseBrowserClient(
            config,
          ) as unknown as ReferralPreviewClient
          const result = await previewReferralCode(
            client,
            raw,
            form.email,
            form.siret,
          )
          if (cancelled) return
          const discount =
            result.status === 'applied'
              ? Math.min(result.discount ?? 100, fee)
              : 0
          setReferralApplication({
            status: result.status,
            code: normalizeReferralCode(raw),
            referrerLabel: result.referrerLabel,
            discountAmount: discount,
            payNow: Math.round((fee - discount) * 100) / 100,
            message: referralMessage(result.status, result.referrerLabel),
          })
        } catch {
          if (!cancelled)
            setReferralApplication({
              status: 'none',
              code: normalizeReferralCode(raw),
              discountAmount: 0,
              payNow: fee,
              message: '',
            })
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [form.referralCode, form.email, form.siret, totals.reservationFee])
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
    setPartnerContext(null)
    setSubmitting(false)
    setCreatedReservation(null)
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

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    setPartnerContext(readPartnerLinkContext({ storage: window.localStorage }))
  }, [open])

  const handlePay = async () => {
    const draftResult = buildReservationDraft({
      siret: form.siret,
      contact: {
        name: form.name,
        company: form.company,
        email: form.email,
        phone: form.phone,
      },
      delivery: {
        deliveryMode: form.deliveryMode,
        deliveryNote: form.deliveryNote,
      },
      referralCode: form.referralCode,
      cgvAccepted,
      cgvVersion: '2026-05-18',
      items,
      containerReference: container.reference,
      containerId: container.id,
      referralApplication,
      partnerContext,
      requestedContainerType,
    })

    if (!draftResult.ok) {
      toast.error('Réservation à compléter', {
        description:
          draftResult.issues[0]?.message ?? 'Vérifiez les champs obligatoires.',
      })
      return
    }

    setSubmitting(true)
    const creation = await reservationCreation.createReservation(
      draftResult.draft,
    )

    if (!creation.ok) {
      setSubmitting(false)
      toast.error('Réservation non enregistrée', {
        description: creation.error,
      })
      return
    }

    track(AnalyticsEvent.ReservationSubmit, {
      persisted: creation.persisted,
    })

    // Persist a lightweight confirmation snapshot the success page can use
    // to render an immediate recap before the webhook completes.
    if (creation.persisted && typeof window !== 'undefined') {
      try {
        const snapshot: StoredConfirmation = {
          reservationId: creation.reservation.id,
          reference: creation.reservation.reference,
          contact: draftResult.draft.contact,
          containerReference: draftResult.draft.containerReference,
          createdAt: new Date().toISOString(),
          payNow: draftResult.draft.payment.payNow,
          items: draftResult.draft.lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            variantName: line.variantName,
            quantity: line.quantity,
            subtotalHt: line.subtotalHt,
          })),
          totals: {
            subtotalHt: draftResult.draft.totals.subtotalHt,
            vat: draftResult.draft.totals.vat,
            totalTtc: draftResult.draft.totals.totalTtc,
          },
        }
        window.sessionStorage.setItem(
          `reservation_confirmation_${creation.reservation.id}`,
          JSON.stringify(snapshot),
        )
      } catch {
        // sessionStorage may be unavailable (private mode etc.) — ignore.
      }
    }

    // Fire the transactional emails (user + admin) in the background.
    // We don't await — the dialog should proceed to Stripe/confirmation
    // instantly. If Resend isn't configured, the server function returns
    // skipped and we just log it.
    if (creation.persisted) {
      void sendConfirmationEmail({
        data: { reservationId: creation.reservation.id },
      }).catch((error: unknown) => {
        console.error('sendReservationConfirmation failed', error)
      })
    }

    // Persisted reservations can be paid via Stripe. Local-only ones
    // (Supabase missing) fall through to the existing confirmation step.
    if (creation.persisted) {
      try {
        const checkout = await startCheckout({
          data: { reservationId: creation.reservation.id },
        })

        if (!checkout.skipped) {
          // Redirect to the hosted Stripe Checkout page. The dialog stays
          // mounted; on cancel/return the user lands on
          // /account/reservations/<id>?session_id=… or ?canceled=true.
          track(AnalyticsEvent.CheckoutRedirect)
          window.location.assign(checkout.url)
          return
        }

        // Stripe not configured — graceful fallback: keep the reservation
        // and surface a "contact manuel" message.
        toast.message('Paiement à connecter', {
          description:
            'Réservation enregistrée. Nous vous contactons sous 24 h pour finaliser le règlement des frais.',
        })
      } catch (error) {
        console.error('createCheckoutSession failed', error)
        toast.error('Paiement temporairement indisponible', {
          description:
            'Votre réservation est enregistrée. Nous reviendrons vers vous pour finaliser le paiement.',
        })
      }
    }

    setSubmitting(false)
    setCreatedReservation({
      reference: creation.reservation.reference,
      persisted: creation.persisted,
      payNow: draftResult.draft.payment.payNow,
    })
    setStep(5)
    if (creation.persisted) {
      toast.success('Réservation enregistrée', {
        description: `${creation.reservation.reference} — confirmation envoyée par email. Paiement à finaliser pour ${formatEUR(draftResult.draft.payment.payNow)}.`,
      })
    } else {
      toast.success('Réservation enregistrée', {
        description: `${creation.reservation.reference} gardée sur cet appareil. Reconnectez-vous pour la synchroniser.`,
      })
    }
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
            {!hasReservableItems
              ? 'Commande à composer'
              : step < 5
                ? `Étape ${step} / 4 - Réservation`
                : 'Confirmation'}
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {!hasReservableItems && 'Composez votre commande avant de réserver'}
            {hasReservableItems &&
              step === 1 &&
              'Identification professionnelle'}
            {hasReservableItems && step === 2 && 'Coordonnées de contact'}
            {hasReservableItems && step === 3 && 'Mode de livraison'}
            {hasReservableItems && step === 4 && 'Récapitulatif et paiement'}
            {hasReservableItems && step === 5 && 'Réservation préparée'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulaire de réservation en plusieurs étapes pour vérifier la
            société, renseigner le contact, choisir la livraison et confirmer le
            paiement.
          </DialogDescription>
        </DialogHeader>

        {!hasReservableItems && <EmptyReservationState />}

        {hasReservableItems && step < 5 && (
          <>
            <StepIndicator step={step} />
            <SummaryCard
              totals={totals}
              referralApplication={referralApplication}
              partnerContext={partnerContext}
            />
          </>
        )}

        {hasReservableItems && step === 1 && (
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

        {hasReservableItems && step === 2 && (
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

        {hasReservableItems && step === 3 && (
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

        {hasReservableItems && step === 4 && (
          <div className="space-y-4">
            <ReferralCodePanel
              value={form.referralCode}
              application={referralApplication}
              onChange={(value) => setForm({ ...form, referralCode: value })}
            />

            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Paiement carte sécurisé
                </span>
              </div>
              <p className="text-foreground/80 text-xs leading-5">
                Vous serez redirigé vers la page de paiement sécurisée pour
                régler les frais de réservation. Aucun numéro de carte n'est
                saisi sur Container Club.
              </p>
              <div className="text-foreground/75 mt-3 rounded-sm bg-[color:var(--sand)] px-3 py-2 text-[11px]">
                Montant à régler aujourd'hui :{' '}
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

            <PaymentTrustBadges />

            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <Reassure
                Icon={Lock}
                t="Paiement sécurisé par Stripe - 3D Secure obligatoire"
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

        {hasReservableItems && step === 5 && createdReservation && (
          <div className="space-y-4">
            <div className="border-[color:var(--forest)]/25 bg-[color:var(--forest)]/10 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--forest)]">
                <ShieldCheck className="h-4 w-4" />
                Référence créée
              </div>
              <div className="mt-3 font-display text-2xl font-semibold tracking-tight">
                {createdReservation.reference}
              </div>
              <p className="text-foreground/75 mt-2 text-xs leading-5">
                {createdReservation.persisted
                  ? 'Réservation enregistrée. Une confirmation par email vient de partir vers votre adresse — vérifiez votre boîte (et le dossier spam au cas où).'
                  : 'La réservation est conservée dans votre aperçu local et apparaîtra dans Mon compte dès que les services seront activés.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <div className="label-eyebrow text-muted-foreground">
                  Montant à régler
                </div>
                <div className="mt-2 font-display text-2xl font-semibold tabular-nums">
                  {formatEUR(createdReservation.payNow)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Frais de réservation calculés et verrouillés.
                </div>
              </div>
              <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <div className="label-eyebrow text-muted-foreground">
                  Prochaine étape
                </div>
                <div className="mt-2 text-sm font-medium">
                  Suivi dans l’espace compte
                </div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  Statut, lignes réservées, paiements et documents seront
                  rattachés à cette référence.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                asChild
                className="h-11 flex-1 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
              >
                <Link to="/account/reservations">Voir mes réservations</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-sm border-[color:var(--sand-deep)]"
                onClick={() => onOpenChange(false)}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EmptyReservationState() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
        <div className="text-sm font-medium">Aucun produit sélectionné</div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Le tunnel de réservation se déclenche après une vraie sélection :
          choisissez vos produits dans le catalogue, ou utilisez le stock 24h si
          votre besoin est urgent.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          asChild
          className="h-11 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
        >
          <Link to="/catalogue">
            Ouvrir le catalogue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-sm border-[color:var(--sand-deep)]"
        >
          <Link to="/stock-24h">Voir le stock 24h</Link>
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({
  totals,
  referralApplication,
  partnerContext,
}: {
  totals: OrderTotals
  referralApplication: ReferralApplication
  partnerContext: PartnerLinkContext | null
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
          {partnerContext && (
            <div className="flex items-start justify-between gap-3 text-[color:var(--forest)]">
              <span className="inline-flex items-center gap-1.5">
                <Handshake className="h-3 w-3" />
                Lien partenaire
              </span>
              <span className="text-right font-medium">
                {partnerContext.displayName}
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
