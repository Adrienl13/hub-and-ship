// Envoi d'une relance depuis l'admin, tracé dans public.admin_follow_ups.
//
// Serveur seulement : l'appelant est vérifié par sa session (is_admin), l'email
// part via Brevo avec l'adresse admin en réponse, puis la trace est écrite avec
// la clé service (la table n'a aucune policy d'insertion). L'email est
// l'effet qui compte : s'il échoue, rien n'est tracé ; si la trace échoue
// après un envoi réussi, on rend { ok: true, traced: false } et on journalise.
// Ni le sujet ni le corps ne sont écrits dans les logs.

import { z } from 'zod'

import {
  FOLLOW_UP_BODY_MAX,
  FOLLOW_UP_BODY_MIN,
  FOLLOW_UP_EMAIL_MAX,
  FOLLOW_UP_SUBJECT_MAX,
  FOLLOW_UP_TARGET_KINDS,
  FOLLOW_UP_TEMPLATE_IDS,
  absoluteFollowUpUrl,
  isInternalFollowUpUrl,
} from '@/lib/admin/follow-ups'
import { callerAdminId } from '@/lib/auth/server-admin'
import { getAdminNotificationEmail, sendEmail } from '@/lib/email/server'
import { buildAdminFollowUpEmail } from '@/lib/email/templates'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const followUpInputSchema = z.object({
  targetKind: z.enum(FOLLOW_UP_TARGET_KINDS),
  targetId: z.string().uuid(),
  recipientEmail: z.string().trim().email().max(FOLLOW_UP_EMAIL_MAX),
  recipientName: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(1).max(FOLLOW_UP_SUBJECT_MAX),
  body: z.string().trim().min(FOLLOW_UP_BODY_MIN).max(FOLLOW_UP_BODY_MAX),
  template: z.enum(FOLLOW_UP_TEMPLATE_IDS),
  reference: z.string().trim().max(80).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  // Lien interne seulement : chemin du site ou URL sur terrassea.com.
  ctaUrl: z
    .string()
    .trim()
    .max(500)
    .refine(isInternalFollowUpUrl, {
      message: 'Le lien doit pointer vers terrassea.com.',
    })
    .optional(),
})

export type SendAdminFollowUpInput = z.infer<typeof followUpInputSchema>

export type SendAdminFollowUpResult =
  | {
      readonly ok: true
      readonly traced: true
      readonly followUpId: string
      readonly deliveryId: string
    }
  | { readonly ok: true; readonly traced: false; readonly deliveryId: string }
  | {
      readonly ok: false
      readonly reason:
        | 'forbidden'
        | 'target_not_found'
        | 'recipient_mismatch'
        | 'email_failed'
        | 'not_configured'
    }

// Le destinataire n'est jamais libre : c'est l'adresse portée par la cible
// (demande, réservation, demande stock, candidature), relue ici avec la clé
// service. Sans cela, la fonction serait un relais d'envoi d'emails de marque
// vers n'importe quelle adresse.
interface TargetLookupClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: 'id',
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          readonly data: Record<string, unknown> | null
          readonly error: { readonly message: string } | null
        }>
      }
    }
  }
}

const TARGET_TABLES: Record<
  SendAdminFollowUpInput['targetKind'],
  { readonly table: string; readonly column: string }
> = {
  contact_request: { table: 'contact_requests', column: 'email' },
  reservation: { table: 'reservations', column: 'contact_snapshot' },
  stock_request: { table: 'stock_requests', column: 'contact_email' },
  partner_application: {
    table: 'partner_applications',
    column: 'contact_email',
  },
}

/** Adresse email portée par la cible, ou null si la cible n'existe pas. */
export async function loadTargetEmail(
  client: TargetLookupClient,
  kind: SendAdminFollowUpInput['targetKind'],
  id: string,
): Promise<string | null> {
  const { table, column } = TARGET_TABLES[kind]
  const { data, error } = await client
    .from(table)
    .select(column)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const raw = data[column]
  if (kind === 'reservation') {
    const snapshot = raw as { readonly email?: unknown } | null
    return typeof snapshot?.email === 'string' ? snapshot.email : null
  }
  return typeof raw === 'string' ? raw : null
}

// La table n'est pas décrite dans src/lib/supabase/types.ts : on cadre la
// surface étroite utilisée ici et on caste le client service à l'appel.
interface FollowUpInsert {
  readonly target_kind: string
  readonly target_id: string
  readonly recipient_email: string
  readonly subject: string
  readonly body: string
  readonly template: string
  readonly sent_by: string
  readonly delivery_id: string
}

interface FollowUpInsertClient {
  from: (table: 'admin_follow_ups') => {
    insert: (values: FollowUpInsert) => {
      select: (columns: 'id') => {
        single: () => PromiseLike<{
          readonly data: { readonly id: string } | null
          readonly error: { readonly message: string } | null
        }>
      }
    }
  }
}

/** Cœur de la fonction serveur, séparé pour être testé sans transport HTTP. */
export async function performAdminFollowUp(
  data: SendAdminFollowUpInput,
): Promise<SendAdminFollowUpResult> {
  const adminId = await callerAdminId()
  if (!adminId) return { ok: false, reason: 'forbidden' }

  let targetEmail: string | null = null
  try {
    targetEmail = await loadTargetEmail(
      getSupabaseAdmin() as unknown as TargetLookupClient,
      data.targetKind,
      data.targetId,
    )
  } catch (error) {
    console.error('sendAdminFollowUp: target lookup threw', {
      targetKind: data.targetKind,
      targetId: data.targetId,
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    return { ok: false, reason: 'target_not_found' }
  }
  if (!targetEmail) return { ok: false, reason: 'target_not_found' }
  if (targetEmail.trim().toLowerCase() !== data.recipientEmail.toLowerCase()) {
    console.warn('sendAdminFollowUp: recipient does not match target', {
      targetKind: data.targetKind,
      targetId: data.targetId,
    })
    return { ok: false, reason: 'recipient_mismatch' }
  }

  const ctaUrl = data.ctaUrl ? absoluteFollowUpUrl(data.ctaUrl) : null
  const email = buildAdminFollowUpEmail({
    subject: data.subject,
    recipientName: data.recipientName ?? null,
    body: data.body,
    reference: data.reference ?? null,
    ctaLabel: data.ctaLabel ?? null,
    ctaUrl,
  })

  const sent = await sendEmail({
    to: data.recipientEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: getAdminNotificationEmail(),
  })

  if (!sent.ok) {
    console.error('sendAdminFollowUp: email failed', {
      targetKind: data.targetKind,
      targetId: data.targetId,
      reason: sent.reason,
    })
    return {
      ok: false,
      reason:
        sent.reason === 'not_configured' ? 'not_configured' : 'email_failed',
    }
  }

  try {
    const admin = getSupabaseAdmin() as unknown as FollowUpInsertClient
    const { data: row, error } = await admin
      .from('admin_follow_ups')
      .insert({
        target_kind: data.targetKind,
        target_id: data.targetId,
        recipient_email: data.recipientEmail,
        subject: data.subject,
        body: data.body,
        template: data.template,
        sent_by: adminId,
        delivery_id: sent.id,
      })
      .select('id')
      .single()

    if (error || !row) {
      console.error('sendAdminFollowUp: trace insert failed', {
        targetKind: data.targetKind,
        targetId: data.targetId,
        deliveryId: sent.id,
        message: error?.message ?? 'no_row',
      })
      return { ok: true, traced: false, deliveryId: sent.id }
    }
    return { ok: true, traced: true, followUpId: row.id, deliveryId: sent.id }
  } catch (error) {
    console.error('sendAdminFollowUp: trace insert threw', {
      targetKind: data.targetKind,
      targetId: data.targetId,
      deliveryId: sent.id,
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    return { ok: true, traced: false, deliveryId: sent.id }
  }
}
