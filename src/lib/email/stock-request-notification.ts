// Admin-only notification fired when a new stock_requests row is created.
// Re-fetches the row via the service role client so the email content cannot
// be tampered with from the browser, and to bypass the write-only RLS posture
// on `stock_requests` for anon visitors.
//
// Returns `{ ok: true, skipped: true }` when RESEND_API_KEY is missing so the
// stock 24 h funnel keeps working in dev / degraded mode.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  getAdminNotificationEmail,
  isEmailConfigured,
  sendEmail,
} from './server'
import { buildStockRequestNotificationToAdmin } from './templates'

const inputSchema = z.object({
  stockRequestId: z.string().uuid(),
})

export type SendStockRequestNotificationResult =
  | { readonly ok: true; readonly skipped: false }
  | { readonly ok: true; readonly skipped: true; readonly reason: string }

function resolveOrigin(request: Request): string {
  const originHeader = request.headers.get('origin')
  if (originHeader) return originHeader
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      // fall through
    }
  }
  return new URL(request.url).origin
}

export const sendStockRequestNotification = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(
    async ({ data }): Promise<SendStockRequestNotificationResult> => {
      if (!isEmailConfigured()) {
        return { ok: true, skipped: true, reason: 'not_configured' }
      }

      const supabase = getSupabaseAdmin()

      const { data: row, error } = await supabase
        .from('stock_requests')
        .select(
          'id, company_name, contact_email, contact_phone, product_name, variant_name, sku, requested_quantity, available_units_snapshot, unit_price_ht, estimated_total_ht, location, customer_note',
        )
        .eq('id', data.stockRequestId)
        .maybeSingle()

      if (error) {
        console.error(
          'sendStockRequestNotification: lookup failed',
          error,
        )
        return { ok: true, skipped: true, reason: 'lookup_failed' }
      }
      if (!row) {
        return { ok: true, skipped: true, reason: 'not_found' }
      }

      const origin = resolveOrigin(getRequest())
      const adminUrl = `${origin}/admin/stock-requests`

      const email = buildStockRequestNotificationToAdmin({
        reference: row.id,
        companyName: row.company_name,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        productName: row.product_name,
        variantName: row.variant_name,
        sku: row.sku,
        requestedQuantity: row.requested_quantity,
        availableUnits: row.available_units_snapshot,
        unitPriceHt: Number(row.unit_price_ht),
        estimatedTotalHt: Number(row.estimated_total_ht),
        location: row.location,
        customerNote: row.customer_note,
        adminUrl,
      })

      const result = await sendEmail({
        to: getAdminNotificationEmail(),
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: row.contact_email,
      })

      if (!result.ok) {
        console.error(
          'sendStockRequestNotification: admin email failed',
          result,
        )
        return { ok: true, skipped: true, reason: 'send_failed' }
      }

      return { ok: true, skipped: false }
    },
  )
