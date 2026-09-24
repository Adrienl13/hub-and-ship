import { STUDIO_BRIEF_SERVER_LIMIT } from './studio/studio-brief-limit'
// Validation pure du formulaire /contact → /api/contact. Depuis la migration
// contact_requests, chaque demande est d'abord enregistrée en base (source de
// vérité, suivi admin), puis notifiée par email (Reply-To = demandeur) avec
// un accusé de réception. Le brouillon porte donc, en plus du message, le
// point de capture (source) et le produit concerné en colonnes.

import { z } from 'zod'

export const CONTACT_TOPICS = [
  'devis',
  'produit',
  'container',
  'reservation',
  'partenariat',
  'autre',
] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]

export const CONTACT_TOPIC_LABEL: Record<ContactTopic, string> = {
  // Demande de devis pour un modèle (tiroir catalogue, fiche produit) :
  // le sujet fait la différence dans la boîte de réception.
  devis: 'Demande de devis',
  produit: 'Produit / catalogue',
  container: 'Container en cours',
  reservation: 'Ma réservation',
  partenariat: 'Partenariat / revente',
  autre: 'Autre question',
}

// Point de capture de la demande (colonne contact_requests.source) : permet
// de compter ce que rapporte chaque parcours, pas seulement chaque sujet.
export const CONTACT_SOURCES = [
  'contact_page',
  'lieux',
  'studio_brief',
  'catalogue_quick_quote',
  'custom_colorway',
  'custom_tabletop',
  'product_page',
] as const
export type ContactSource = (typeof CONTACT_SOURCES)[number]

export const CONTACT_SOURCE_LABEL: Record<ContactSource, string> = {
  contact_page: 'Page contact',
  lieux: 'Lieux équipés',
  studio_brief: 'Brief Studio',
  catalogue_quick_quote: 'Devis rapide catalogue',
  custom_colorway: 'Coloris sur mesure',
  custom_tabletop: 'Plateau sur mesure',
  product_page: 'Fiche produit',
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

const optionalTextSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))

// Produit concerné (devis rapide, coloris, plateau) : en colonnes pour
// compter et filtrer côté admin, le message garde la version lisible.
const contactProductSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  design: optionalTextSchema,
  quantity: z.number().int().positive().max(100_000).optional().nullable(),
  priceLabel: optionalTextSchema,
})

const contactMessageSchema = z.object({
  studioBrief: z.string().max(STUDIO_BRIEF_SERVER_LIMIT).optional(),
  name: z.string().trim().min(2, 'Votre nom est obligatoire').max(140),
  email: z.string().trim().email('Email invalide').max(254),
  company: z.string().trim().max(180).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  topic: z.enum(CONTACT_TOPICS).optional(),
  source: z.enum(CONTACT_SOURCES).optional(),
  product: contactProductSchema.optional().nullable(),
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

export interface ContactProduct {
  readonly sku: string
  readonly name: string
  readonly design: string | null
  readonly quantity: number | null
  readonly priceLabel: string | null
}

export interface ContactMessageDraft {
  readonly name: string
  readonly email: string
  readonly company: string | null
  readonly phone: string | null
  readonly topic: ContactTopic
  readonly source: ContactSource
  /** Message complet tel qu'il part par email (brief Studio annexé). */
  readonly message: string
  /** Brief Studio seul, pour la colonne dédiée (null sans brief). */
  readonly studioBrief: string | null
  readonly product: ContactProduct | null
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

  const studioBrief = emptyToNull(parsed.data.studioBrief)
  const product = parsed.data.product

  return {
    ok: true,
    draft: {
      name: parsed.data.name,
      email: parsed.data.email.toLocaleLowerCase('fr-FR'),
      company: emptyToNull(parsed.data.company),
      phone: emptyToNull(parsed.data.phone),
      topic: parsed.data.topic ?? 'autre',
      // Sans source explicite, un brief Studio trahit son parcours ; sinon
      // c'est le formulaire de la page contact.
      source:
        parsed.data.source ?? (studioBrief ? 'studio_brief' : 'contact_page'),
      message:
        parsed.data.message +
        (parsed.data.studioBrief
          ? '\n\nPROJET STUDIO — DÉCLARATION CLIENT À REVALIDER (aucun devis ferme)\n' +
            parsed.data.studioBrief
          : ''),
      studioBrief,
      product: product
        ? {
            sku: product.sku,
            name: product.name,
            design: product.design ?? null,
            quantity: product.quantity ?? null,
            priceLabel: product.priceLabel ?? null,
          }
        : null,
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
