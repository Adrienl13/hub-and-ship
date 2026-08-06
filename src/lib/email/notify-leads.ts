// Server-only lead notifications. Fires an admin notification + a requester
// confirmation when a partner request or a stock 24h lead is captured. Uses the
// shared sendEmail() which no-ops gracefully when email is not configured, so
// these are safe to call from the intake endpoints without ever failing the
// lead-capture response.

import {
  getAdminNotificationEmail,
  sendEmail,
} from '@/lib/email/server'
import {
  buildContactAdminEmail,
  buildContactConfirmationEmail,
  buildPartnerRequestAdminEmail,
  buildPartnerRequestConfirmationEmail,
  buildPaymentConfirmedAdminEmail,
  buildPaymentConfirmedEmailToUser,
  buildStockRequestAdminEmail,
  buildStockRequestConfirmationEmail,
  type ContactEmailInput,
  type PartnerRequestEmailInput,
  type PaymentConfirmedEmailInput,
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
      replyTo: getAdminNotificationEmail(),
    })
  }
}

export async function notifyPaymentConfirmed(
  input: Omit<
    PaymentConfirmedEmailInput,
    'accountUrl' | 'accountLinkIsMagic'
  > & {
    /** One-time sign-in URL (magic link). Falls back to the account page. */
    readonly accountAccessLink?: string | null
  },
): Promise<void> {
  const full: PaymentConfirmedEmailInput = {
    ...input,
    accountUrl: input.accountAccessLink ?? `${SITE_URL}/account/reservations`,
    accountLinkIsMagic: Boolean(input.accountAccessLink),
  }

  const admin = buildPaymentConfirmedAdminEmail(full)
  await sendEmail({
    to: getAdminNotificationEmail(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
  })

  if (input.customerEmail) {
    const user = buildPaymentConfirmedEmailToUser(full)
    await sendEmail({
      to: input.customerEmail,
      subject: user.subject,
      html: user.html,
      text: user.text,
      replyTo: getAdminNotificationEmail(),
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
      replyTo: getAdminNotificationEmail(),
    })
  }
}

export async function notifyContactMessage(
  input: ContactEmailInput,
): Promise<void> {
  const admin = buildContactAdminEmail(input)
  await sendEmail({
    to: getAdminNotificationEmail(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
    replyTo: input.email,
  })

  const confirmation = buildContactConfirmationEmail(input)
  await sendEmail({
    to: input.email,
    subject: confirmation.subject,
    html: confirmation.html,
    text: confirmation.text,
    replyTo: getAdminNotificationEmail(),
  })
}
