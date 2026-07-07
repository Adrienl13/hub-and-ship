// POST /api/cron/payment-reminders — relance les réservations impayées.
//
// Déclenché par un scheduler externe (voir docs/RUNBOOK_RELANCES.md) avec le
// header `x-cron-secret`. Politique J+1 / J+3 (max 2 relances) décidée par la
// logique pure resolveDueReminders ; l'update conditionné sur l'ancien
// compteur rend l'envoi idempotent même si deux exécutions se chevauchent.

import { createFileRoute } from '@tanstack/react-router'

import {
  createAccountAccessLink,
  type MagicLinkAdminClient,
} from '@/lib/auth/magic-link'
import { sendEmail } from '@/lib/email/server'
import { buildPaymentReminderEmail } from '@/lib/email/templates'
import {
  contactFromSnapshot,
  resolveDueReminders,
  type ReminderCandidate,
} from '@/lib/reservations/payment-reminders'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const SITE_URL = 'https://prosimport.com'
const BATCH_LIMIT = 50

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

function methodNotAllowed(): Response {
  return jsonResponse(
    { ok: false, error: 'Method Not Allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  )
}

export async function handlePaymentReminders(
  request: Request,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()

  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return jsonResponse(
      { ok: false, error: 'CRON_SECRET not configured' },
      { status: 503 },
    )
  }
  if (request.headers.get('x-cron-secret') !== secret) {
    return jsonResponse({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabaseAdmin()
  const { data: rows, error } = await supabase
    .from('reservations')
    .select(
      'id, reference, status, created_at, contact_snapshot, pay_now, payment_reminder_count, payment_reminder_last_at',
    )
    .eq('status', 'pending_reservation_fee')
    .lt('payment_reminder_count', 2)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, { status: 503 })
  }

  const now = new Date()
  const candidates: ReminderCandidate[] = (rows ?? []).map((row) => {
    const contact = contactFromSnapshot(row.contact_snapshot)
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      createdAt: row.created_at,
      reminderCount: row.payment_reminder_count ?? 0,
      lastReminderAt: row.payment_reminder_last_at,
      email: contact.email,
      contactName: contact.name,
      payNow: Number(row.pay_now),
    }
  })

  const due = resolveDueReminders(candidates, now)
  let sent = 0
  const failures: string[] = []

  for (const reminder of due) {
    // Verrou d'idempotence AVANT l'envoi : si une autre exécution a déjà
    // incrémenté le compteur, l'update ne matche aucune ligne et on saute.
    const { data: locked, error: lockError } = await supabase
      .from('reservations')
      .update({
        payment_reminder_count: reminder.expectedReminderCount + 1,
        payment_reminder_last_at: now.toISOString(),
      } as never)
      .eq('id', reminder.id)
      .eq('payment_reminder_count', reminder.expectedReminderCount)
      .eq('status', 'pending_reservation_fee')
      .select('id')

    if (lockError || !locked || locked.length === 0) continue

    try {
      // La page /account/reservations/<id>?canceled=true porte le bouton de
      // reprise de paiement ; le magic link y connecte l'invité directement.
      const payPath = `/account/reservations/${reminder.id}?canceled=true`
      const magicLink = await createAccountAccessLink({
        client: supabase as unknown as MagicLinkAdminClient,
        email: reminder.email,
        redirectTo: `${SITE_URL}${payPath}`,
      })
      const email = buildPaymentReminderEmail({
        reference: reminder.reference,
        contactName: reminder.contactName,
        payNow: reminder.payNow,
        stage: reminder.stage,
        payUrl: magicLink ?? `${SITE_URL}${payPath}`,
      })
      const result = await sendEmail({
        to: reminder.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })
      if (result.ok || (!result.ok && result.skipped)) {
        // skipped = Brevo non configuré (dev) : compté comme traité, le
        // verrou d'idempotence a déjà consommé le créneau de relance.
        sent += 1
      } else {
        failures.push(reminder.reference)
      }
    } catch (sendError) {
      console.error('payment reminders: send failed', {
        reference: reminder.reference,
        sendError,
      })
      failures.push(reminder.reference)
    }
  }

  return jsonResponse(
    { ok: true, scanned: candidates.length, due: due.length, sent, failures },
    { status: 200 },
  )
}

export const Route = createFileRoute('/api/cron/payment-reminders')({
  server: {
    handlers: {
      GET: () => methodNotAllowed(),
      POST: async ({ request }) => handlePaymentReminders(request),
    },
  },
})
