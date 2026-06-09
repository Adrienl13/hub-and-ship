// Server function that emails an issued invoice to the client. Loads the
// invoice via the SERVICE ROLE client (so it works regardless of the caller's
// RLS) and sends only to the buyer recorded on the invoice snapshot. No-op
// (skipped) when RESEND_API_KEY is absent — never throws.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getAdminNotificationEmail,
  isEmailConfigured,
  sendEmail,
} from './server'
import { buildInvoiceEmailToUser } from './templates'

const inputSchema = z.object({
  invoiceId: z.string().uuid(),
})

export type SendInvoiceEmailResult =
  | { readonly ok: true; readonly skipped: false }
  | { readonly ok: true; readonly skipped: true; readonly reason: string }

function resolveOrigin(request: Request): string {
  const originHeader = request.headers.get('origin')
  if (originHeader) return originHeader
  try {
    return new URL(request.url).origin
  } catch {
    return 'https://prosimport.com'
  }
}

export const sendInvoiceEmail = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<SendInvoiceEmailResult> => {
    if (!isEmailConfigured()) {
      return { ok: true, skipped: true, reason: 'not_configured' }
    }

    // `invoices` is not in the generated Database types, so use a minimal
    // typed view of the admin client for this read.
    const supabase = getSupabaseAdmin() as unknown as {
      from: (table: 'invoices') => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            maybeSingle: () => Promise<{
              data: {
                id: string
                reservation_id: string
                number: string
                total_ttc: number | string
                snapshot: unknown
              } | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('id, reservation_id, number, total_ttc, snapshot')
      .eq('id', data.invoiceId)
      .maybeSingle()

    if (error || !invoice) {
      console.error('sendInvoiceEmail: invoice lookup failed', error)
      return { ok: true, skipped: true, reason: 'invoice_not_found' }
    }

    const snapshot = (invoice.snapshot ?? {}) as {
      readonly reference?: string
      readonly contact?: { readonly email?: string }
    }
    const email = snapshot.contact?.email
    if (!email) {
      return { ok: true, skipped: true, reason: 'no_contact_email' }
    }

    const origin = resolveOrigin(getRequest())
    const message = buildInvoiceEmailToUser({
      number: invoice.number,
      reference: snapshot.reference ?? invoice.number,
      totalTtc: Number(invoice.total_ttc),
      invoiceUrl: `${origin}/account/reservations/${invoice.reservation_id}/facture/${invoice.id}`,
    })

    const result = await sendEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: getAdminNotificationEmail(),
    })

    if (!result.ok) {
      console.error('sendInvoiceEmail: send failed', result)
    }
    return { ok: true, skipped: false }
  })
