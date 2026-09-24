// Relances envoyées depuis l'admin : modèles, brouillons et validation.
//
// Module PUR (aucun accès réseau ni base) partagé entre le dialogue de relance
// (navigateur) et la fonction serveur qui envoie l'email et journalise
// l'envoi dans public.admin_follow_ups (migration 59). Les bornes reprennent
// celles de la table : sujet ≤ 200, corps ≤ 6000, email ≤ 254.

import { formatAdminDate } from '@/lib/admin/format'

export const FOLLOW_UP_TARGET_KINDS = [
  'contact_request',
  'reservation',
  'stock_request',
  'partner_application',
] as const
export type FollowUpTargetKind = (typeof FOLLOW_UP_TARGET_KINDS)[number]

export const FOLLOW_UP_TEMPLATE_IDS = [
  'devis',
  'informations',
  'paiement',
  'acompte',
  'libre',
] as const
export type FollowUpTemplateId = (typeof FOLLOW_UP_TEMPLATE_IDS)[number]

export const FOLLOW_UP_SUBJECT_MAX = 200
export const FOLLOW_UP_BODY_MIN = 20
export const FOLLOW_UP_BODY_MAX = 6000
export const FOLLOW_UP_EMAIL_MAX = 254

/** Ce que l'on sait de la cible, pour préremplir sujet et corps. */
export interface FollowUpContext {
  readonly name: string
  readonly company?: string | null
  readonly reference?: string | null
  readonly productName?: string | null
  readonly quantity?: number | null
  readonly priceLabel?: string | null
}

export interface FollowUpDraft {
  readonly subject: string
  readonly body: string
}

interface FollowUpTemplate {
  readonly label: string
  readonly description: string
  readonly subject: (context: FollowUpContext) => string
  readonly body: (context: FollowUpContext) => string
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

// Le corps ne contient pas la salutation : le gabarit d'email l'ajoute
// (« Bonjour {nom}, ») ainsi que la signature de l'équipe.
export const FOLLOW_UP_TEMPLATES: Record<FollowUpTemplateId, FollowUpTemplate> =
  {
    devis: {
      label: 'Devis',
      description: 'Le devis a été envoyé, sans retour du client.',
      subject: (context) => {
        const reference = clean(context.reference)
        return reference
          ? `Votre devis Terrassea — ${reference}`
          : 'Votre devis Terrassea'
      },
      body: (context) => {
        const product = clean(context.productName)
        const company = clean(context.company)
        const priceLabel = clean(context.priceLabel)
        const quantity =
          typeof context.quantity === 'number' && context.quantity > 0
            ? context.quantity
            : null
        const what = product
          ? ` pour ${product}${quantity ? ` (${quantity} unités)` : ''}`
          : quantity
            ? ` (${quantity} unités)`
            : ''
        const who = company ? ` pour ${company}` : ''
        const price = priceLabel ? `, sur la base de ${priceLabel}` : ''
        return `Nous revenons vers vous au sujet de votre demande de devis${what}${who}.

Avez-vous eu le temps d'en prendre connaissance ? Nous restons à votre disposition pour ajuster les quantités, les coloris ou le délai de livraison${price}.

Un simple retour à cet email suffit : nous vous rappelons dans la journée.`
      },
    },
    informations: {
      label: 'Informations',
      description: 'Le client attendait des informations ou une réponse.',
      subject: () => 'Votre demande Terrassea',
      body: (context) => {
        const product = clean(context.productName)
        const reference = clean(context.reference)
        const about = product
          ? ` concernant ${product}`
          : reference
            ? ` (référence ${reference})`
            : ''
        return `Nous revenons vers vous au sujet de votre demande${about}.

Avez-vous obtenu toutes les informations dont vous aviez besoin ? Si une question reste ouverte — matières, délais, livraison, conditions professionnelles — nous y répondons volontiers.

Un simple retour à cet email suffit : nous vous rappelons dans la journée.`
      },
    },
    paiement: {
      label: 'Paiement',
      description: 'Réservation enregistrée, règlement en attente.',
      subject: () => 'Votre réservation Terrassea : règlement en attente',
      body: (context) => {
        const reference = clean(context.reference)
        const priceLabel = clean(context.priceLabel)
        const ref = reference ? ` ${reference}` : ''
        const amount = priceLabel ? ` (${priceLabel})` : ''
        return `Votre réservation${ref} est bien enregistrée, mais votre place n'est pas encore verrouillée : les frais de réservation${amount} restent à régler. Ils sont déduits du total de la commande.

Le container part dès qu'il est complet ; à réception du règlement, votre place est verrouillée et la production peut démarrer.

Un imprévu, une question sur les quantités ou la livraison ? Répondez simplement à cet email.`
      },
    },
    acompte: {
      label: 'Acompte',
      description:
        'Place verrouillée, acompte attendu pour lancer la production.',
      subject: () => 'Votre réservation Terrassea : acompte en attente',
      body: (context) => {
        const reference = clean(context.reference)
        const priceLabel = clean(context.priceLabel)
        const ref = reference ? ` ${reference}` : ''
        const amount = priceLabel ? ` (${priceLabel})` : ''
        return `Votre place sur le container est bien verrouillée pour la réservation${ref}. Pour lancer la production, votre acompte${amount} est maintenant attendu.

Dès sa réception, nous confirmons la mise en fabrication et vous tenons informé des étapes suivantes : contrôle qualité, embarquement, livraison.

Un imprévu, une question sur le règlement ou le calendrier ? Répondez simplement à cet email.`
      },
    },
    libre: {
      label: 'Message libre',
      description: 'Sujet et corps entièrement rédigés par vous.',
      subject: (context) => {
        const reference = clean(context.reference)
        return reference
          ? `Terrassea — ${reference}`
          : 'Un message de Terrassea'
      },
      body: () => '',
    },
  }

export function buildFollowUpDraft(
  template: FollowUpTemplateId,
  context: FollowUpContext,
): FollowUpDraft {
  const spec = FOLLOW_UP_TEMPLATES[template]
  return {
    subject: spec.subject(context).slice(0, FOLLOW_UP_SUBJECT_MAX),
    body: spec.body(context),
  }
}

/** Le modèle qui convient à une réservation selon son statut. */
export function reservationFollowUpTemplate(
  status: string,
): FollowUpTemplateId {
  if (status === 'pending_reservation_fee') return 'paiement'
  if (status === 'deposit_called') return 'acompte'
  return 'informations'
}

// Adresse « raisonnable » : un @ entouré de caractères, un point dans le
// domaine, ni espace ni chevron. La validation stricte reste côté Brevo.
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

export function isValidFollowUpEmail(value: string): boolean {
  const email = value.trim()
  return (
    email.length > 0 &&
    email.length <= FOLLOW_UP_EMAIL_MAX &&
    EMAIL_PATTERN.test(email)
  )
}

/**
 * Lien d'appel à l'action autorisé dans une relance : un chemin du site
 * (« /account/… ») ou une URL absolue sur terrassea.com. Rien d'autre, pour
 * qu'un email envoyé au nom de Terrassea ne pointe jamais ailleurs.
 */
export const FOLLOW_UP_SITE_URL = 'https://terrassea.com'

export function isInternalFollowUpUrl(value: string): boolean {
  const url = value.trim()
  if (url === '') return false
  if (url.startsWith('/')) {
    return !url.startsWith('//') && !/[\s\\]/.test(url)
  }
  return (
    (url === FOLLOW_UP_SITE_URL || url.startsWith(`${FOLLOW_UP_SITE_URL}/`)) &&
    !/\s/.test(url)
  )
}

/** Rend un lien interne absolu (les chemins deviennent https://terrassea.com/…). */
export function absoluteFollowUpUrl(value: string): string {
  const url = value.trim()
  return url.startsWith('/') ? `${FOLLOW_UP_SITE_URL}${url}` : url
}

export interface FollowUpInput {
  readonly subject: string
  readonly body: string
  readonly email: string
}

export interface FollowUpErrors {
  readonly subject?: string
  readonly body?: string
  readonly email?: string
}

export type FollowUpValidation =
  | { readonly ok: true; readonly value: FollowUpInput }
  | { readonly ok: false; readonly errors: FollowUpErrors }

export function validateFollowUp(input: FollowUpInput): FollowUpValidation {
  const subject = input.subject.trim()
  const body = input.body.trim()
  const email = input.email.trim()
  const errors: { subject?: string; body?: string; email?: string } = {}

  if (subject === '') {
    errors.subject = 'Le sujet est obligatoire.'
  } else if (subject.length > FOLLOW_UP_SUBJECT_MAX) {
    errors.subject = `Le sujet dépasse ${FOLLOW_UP_SUBJECT_MAX} caractères.`
  }

  if (body.length < FOLLOW_UP_BODY_MIN) {
    errors.body = `Le message doit compter au moins ${FOLLOW_UP_BODY_MIN} caractères.`
  } else if (body.length > FOLLOW_UP_BODY_MAX) {
    errors.body = `Le message dépasse ${FOLLOW_UP_BODY_MAX} caractères.`
  }

  if (!isValidFollowUpEmail(email)) {
    errors.email = 'Adresse email du destinataire invalide.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { subject, body, email } }
}

/**
 * « Relancé le jj/mm/aaaa (n) » à partir des relances d'une cible, la plus
 * récente en tête ; `null` quand il n'y en a aucune.
 */
export function describeFollowUps(
  rows: ReadonlyArray<{ readonly sentAt: string }>,
): string | null {
  if (rows.length === 0) return null
  const latest = rows.reduce((best, row) =>
    row.sentAt > best.sentAt ? row : best,
  )
  return `Relancé le ${formatAdminDate(latest.sentAt)} (${rows.length})`
}
