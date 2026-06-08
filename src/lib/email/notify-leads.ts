// Server-only lead notifications. Fires an admin notification + a requester
// confirmation when a partner request or a stock 24h lead is captured. Uses the
// shared sendEmail() which no-ops gracefully when RESEND_API_KEY is absent, so
// these are safe to call from the intake endpoints without ever failing the
// lead-capture response.

import {
  getAdminNotificationEmail,
  sendEmail,
} from '@/lib/email/server'
import {
  buildPartnerRequestAdminEmail,
  buildPartnerRequestConfirmationEmail,
  buildStockRequestAdminEmail,
  buildStockRequestConfirmationEmail,
  type PartnerRequestEmailInput,
  type StockRequestEmailInput,
} from '@/lib/email/templates'

const SITE_URL = 'https://prosimport.com'

export async function notifyPartnerRequest(
  input: Omit<PartnerRequestEmailInput, 'adminUrl'>,
): Promise<void> {
  const full: PartnerRequestEmailInput = {
    ...input,
    adminUrl: `${SITE_URL}/admin?tab=partners`,
  }

  const admin = buildPartnerRequestAdminEmail(full)
  await sendEmail({
    to: getAdminNotificationEmail(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
    replyTo: input.contactEmail,
  })

  if (input.contactEmail) {
    const confirmation = buildPartnerRequestConfirmationEmail(full)
    await sendEmail({
      to: input.contactEmail,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    })
  }
}

export async function notifyStockRequest(
  input: Omit<StockRequestEmailInput, 'adminUrl'>,
): Promise<void> {
  const full: StockRequestEmailInput = {
    ...input,
    adminUrl: `${SITE_URL}/admin?tab=stock-requests`,
  }

  const admin = buildStockRequestAdminEmail(full)
  await sendEmail({
    to: getAdminNotificationEmail(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
    replyTo: input.contactEmail,
  })

  if (input.contactEmail) {
    const confirmation = buildStockRequestConfirmationEmail(full)
    await sendEmail({
      to: input.contactEmail,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    })
  }
}
