// Pure validation for the /contact form → /api/contact intake. No DB table:
// a contact message is an email conversation, so the endpoint fires the admin
// notification (Reply-To = requester) + an acknowledgement, nothing else.

import { z } from 'zod'

export const CONTACT_TOPICS = [
  'produit',
  'container',
  'reservation',
  'partenariat',
  'autre',
] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]

export const CONTACT_TOPIC_LABEL: Record<ContactTopic, string> = {
  produit: 'Produit / catalogue',
  container: 'Container en cours',
  reservation: 'Ma réservation',
  partenariat: 'Partenariat / revente',
  autre: 'Autre question',
}

// Attribution first-touch (utm/partner_ref) : mêmes champs que les
// réservations et demandes stock — un lead payé qui convertit par contact
// doit rester traçable jusqu'à la campagne (readiness publicité 08/2026).
const attributionFieldSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Votre nom est obligatoire').max(140),
  email: z.string().trim().email('Email invalide').max(254),
  company: z.string().trim().max(180).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  topic: z.enum(CONTACT_TOPICS).optional(),
  message: z
    .string()
    .trim()
    .min(10, 'Votre message est trop court (10 caractères minimum)')
    .max(3000, 'Votre message est trop long (3000 caractères maximum)'),
  attribution: z
    .object({
      utm_source: attributionFieldSchema,
      utm_medium: attributionFieldSchema,
      utm_campaign: attributionFieldSchema,
      partner_ref: attributionFieldSchema,
    })
    .optional(),
})

export type ContactMessageInput = z.input<typeof contactMessageSchema>

export interface ContactAttribution {
  readonly utm_source: string | null
  readonly utm_medium: string | null
  readonly utm_campaign: string | null
  readonly partner_ref: string | null
}

export interface ContactMessageDraft {
  readonly name: string
  readonly email: string
  readonly company: string | null
  readonly phone: string | null
  readonly topic: ContactTopic
  readonly message: string
  readonly attribution: ContactAttribution | null
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function buildContactMessageDraft(
  input: unknown,
):
  | { readonly ok: true; readonly draft: ContactMessageDraft }
  | { readonly ok: false; readonly error: string } {
  const parsed = contactMessageSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Message invalide',
    }
  }

  const attribution = parsed.data.attribution
  const hasAttribution =
    attribution &&
    (attribution.utm_source ||
      attribution.utm_medium ||
      attribution.utm_campaign ||
      attribution.partner_ref)

  return {
    ok: true,
    draft: {
      name: parsed.data.name,
      email: parsed.data.email.toLocaleLowerCase('fr-FR'),
      company: emptyToNull(parsed.data.company),
      phone: emptyToNull(parsed.data.phone),
      topic: parsed.data.topic ?? 'autre',
      message: parsed.data.message,
      attribution: hasAttribution
        ? {
            utm_source: attribution.utm_source ?? null,
            utm_medium: attribution.utm_medium ?? null,
            utm_campaign: attribution.utm_campaign ?? null,
            partner_ref: attribution.partner_ref ?? null,
          }
        : null,
    },
  }
}
