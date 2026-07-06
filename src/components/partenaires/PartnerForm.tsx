import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AnalyticsEvent, track } from '@/lib/analytics'
import { getAttributionFields } from '@/lib/analytics/attribution'
import {
  buildPartnerApplicationDraft,
  toPartnerRequestApiPayload,
  PARTNER_ACTIVITY_PROFILES,
  PARTNER_ACTIVITY_PROFILE_LABEL,
  PARTNER_TARGET_STATUSES,
  PARTNER_TARGET_STATUS_LABEL,
} from '@/lib/partner-applications'

export interface PartnerFormPrefill {
  readonly profile: string
  readonly status: string
  readonly nonce: number
}

interface FormState {
  company: string
  siret: string
  contactName: string
  phone: string
  email: string
  activityProfile: string
  targetStatus: string
  zone: string
  estimatedVolume: string
  message: string
}

const EMPTY_FORM: FormState = {
  company: '',
  siret: '',
  contactName: '',
  phone: '',
  email: '',
  activityProfile: '',
  targetStatus: '',
  zone: '',
  estimatedVolume: '',
  message: '',
}

const inputClass =
  'w-full rounded-[5px] border border-[color:var(--border-strong)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]'
const labelClass =
  'mb-1.5 block text-[12.5px] font-semibold text-[color:var(--ink-soft)]'

export function PartnerForm({ prefill }: { readonly prefill: PartnerFormPrefill }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // Sync the "profil" / "statut visé" selects when the selector or a card CTA
  // pre-fills a choice (nonce forces re-apply even on repeated clicks).
  useEffect(() => {
    if (prefill.nonce === 0) return
    setForm((previous) => ({
      ...previous,
      activityProfile: prefill.profile || previous.activityProfile,
      targetStatus: prefill.status || previous.targetStatus,
    }))
  }, [prefill])

  const update = (key: keyof FormState) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const submit = async () => {
    const draftResult = buildPartnerApplicationDraft({
      companyName: form.company,
      siret: form.siret,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone,
      activityProfile: form.activityProfile,
      targetStatus: form.targetStatus,
      zone: form.zone,
      estimatedVolume: form.estimatedVolume,
      message: form.message,
    })

    if (!draftResult.ok) {
      toast.error('Candidature à compléter', {
        description:
          draftResult.issues[0]?.message ?? 'Vérifiez les champs obligatoires.',
      })
      return
    }

    setSubmitting(true)
    // Server-side intake: /api/partner-requests validates, inserts with the
    // service-role client (never the browser anon key) and fires the Brevo
    // notifications (admin + accusé de réception 48 h).
    let submitted = false
    try {
      const response = await fetch('/api/partner-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          toPartnerRequestApiPayload(
            draftResult.draft,
            getAttributionFields(Date.now()),
          ),
        ),
      })
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        error?: string
      } | null
      submitted = response.ok && payload?.ok === true
      if (!submitted) {
        toast.error('Candidature non envoyée', {
          description:
            payload?.error ?? 'Réessayez dans un instant ou écrivez-nous.',
        })
      }
    } catch {
      toast.error('Candidature non envoyée', {
        description: 'Connexion impossible. Réessayez dans un instant.',
      })
    }
    setSubmitting(false)
    if (!submitted) return

    track(AnalyticsEvent.PartnerRequest, {
      profile: draftResult.draft.activityProfile,
      status: draftResult.draft.targetStatus,
    })
    toast.success('Candidature envoyée', {
      description: 'Notre équipe revient vers vous sous 48 h.',
    })
    setForm(EMPTY_FORM)
  }

  return (
    <section
      id="candidature"
      className="border-y border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-14"
    >
      <div className="mx-auto grid max-w-5xl items-start gap-11 px-6 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-7">
          <span className="mono block text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
            Candidature partenaire
          </span>
          <h2 className="mt-2 font-display text-2xl font-black">
            Rejoindre le réseau
          </h2>

          <div className="mt-5 space-y-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Raison sociale">
                <input
                  className={inputClass}
                  value={form.company}
                  onChange={(e) => update('company')(e.target.value)}
                  placeholder="Ex. Distri Boissons Provence"
                />
              </Field>
              <Field label="SIRET">
                <input
                  className={`${inputClass} mono tracking-[0.06em]`}
                  value={form.siret}
                  inputMode="numeric"
                  maxLength={17}
                  onChange={(e) => update('siret')(e.target.value)}
                  placeholder="14 chiffres"
                />
              </Field>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Contact">
                <input
                  className={inputClass}
                  value={form.contactName}
                  onChange={(e) => update('contactName')(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </Field>
              <Field label="Téléphone">
                <input
                  className={inputClass}
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone')(e.target.value)}
                  placeholder="06 — — — —"
                />
              </Field>
            </div>
            <Field label="Email professionnel">
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => update('email')(e.target.value)}
                placeholder="vous@entreprise.fr"
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Profil d’activité">
                <select
                  className={inputClass}
                  value={form.activityProfile}
                  onChange={(e) => update('activityProfile')(e.target.value)}
                >
                  <option value="">Sélectionner…</option>
                  {PARTNER_ACTIVITY_PROFILES.map((profile) => (
                    <option key={profile} value={profile}>
                      {PARTNER_ACTIVITY_PROFILE_LABEL[profile]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Statut visé">
                <select
                  className={inputClass}
                  value={form.targetStatus}
                  onChange={(e) => update('targetStatus')(e.target.value)}
                >
                  <option value="">Sélectionner…</option>
                  {PARTNER_TARGET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PARTNER_TARGET_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Zone d’intervention">
                <input
                  className={inputClass}
                  value={form.zone}
                  onChange={(e) => update('zone')(e.target.value)}
                  placeholder="Ex. Bouches-du-Rhône, PACA…"
                />
              </Field>
              <Field label="Clients CHR / volume estimé">
                <input
                  className={inputClass}
                  value={form.estimatedVolume}
                  onChange={(e) => update('estimatedVolume')(e.target.value)}
                  placeholder="Ex. 120 clients en tournée"
                />
              </Field>
            </div>
            <Field label="Votre contexte (optionnel)">
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={form.message}
                onChange={(e) => update('message')(e.target.value)}
                placeholder="Parlez-nous de votre activité, vos clients, vos attentes…"
              />
            </Field>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="w-full justify-center rounded-[4px] bg-[color:var(--ember)] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--ember-hover)] disabled:opacity-60"
            >
              {submitting
                ? 'Envoi…'
                : 'Envoyer ma candidature — réponse sous 48h'}
            </button>
            <p className="text-[12.5px] leading-relaxed text-[color:var(--muted)]">
              La validation du statut est effectuée par notre équipe après
              vérification SIRET. Les grilles tarifaires partenaires sont
              communiquées uniquement après validation. Données traitées par
              Pros Import EURL — jamais revendues.
            </p>
          </div>
        </div>

        <PartnerTrustPanel />
      </div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

const TRUST_ITEMS: ReadonlyArray<{ tag: string; text: string }> = [
  {
    tag: 'SGS',
    text: 'Rapports de contrôle qualité consultables sur chaque container livré',
  },
  {
    tag: 'SIRET',
    text: '988 269 981 00011 — RCS Paris · Importation et douane incluses',
  },
  {
    tag: '2 ANS',
    text: 'Garantie fabricant + SAV France sur l’ensemble du catalogue',
  },
  {
    tag: '€ ENC.',
    text: 'Commissions et RFA versées sur CA encaissé — comptabilité saine, zéro mauvaise surprise',
  },
]

function PartnerTrustPanel() {
  return (
    <div>
      <h3 className="text-lg font-extrabold">Pourquoi les pros nous font confiance</h3>
      <p className="mt-2.5 text-[14.5px] text-[color:var(--ink-soft)]">
        Container Club est la marque de Pros Import EURL, importateur officiel
        français. Chaque container est contrôlé par SGS avant expédition,
        dédouané par nos soins, et couvert par une garantie 2 ans avec SAV en
        France.
      </p>
      <div className="mt-4.5 grid gap-3">
        {TRUST_ITEMS.map((item) => (
          <div key={item.tag} className="flex items-start gap-3 text-sm">
            <span className="mono flex-none rounded-[3px] bg-[color:var(--ink)] px-2 py-1 text-[11px] tracking-[0.08em] text-[color:var(--sand-soft)]">
              {item.tag}
            </span>
            <span className="text-[color:var(--ink-soft)]">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
