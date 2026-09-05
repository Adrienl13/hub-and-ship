// Server-only lead notifications. Fires an admin notification + a requester
// confirmation when a partner request or a stock 24h lead is captured. Uses the
// shared sendEmail() which no-ops gracefully when email is not configured, so
// these are safe to call from the intake endpoints without ever failing the
// lead-capture response.

import {
  getAdminNotificationEmail,
  sendEmail,
  type SendEmailResult,
} from '@/lib/email/server'
import {
  buildContactAdminEmail,
  buildContactConfirmationEmail,
  buildPartnerRequestAdminEmail,
  buildPartnerRequestConfirmationEmail,
  buildPaymentConfirmedAdminEmail,
  buildPaymentConfirmedEmailToUser,
  buildReportAccessAdminEmail,
  buildReportAccessApprovedEmail,
  buildStockRequestAdminEmail,
  buildStockRequestConfirmationEmail,
  type ContactEmailInput,
  type PartnerRequestEmailInput,
  type PaymentConfirmedEmailInput,
  type ReportAccessRequestEmailInput,
  type StockRequestEmailInput,
} from '@/lib/email/templates'

const SITE_URL = 'https://prosimport.com'

/** Trace un échec d'email admin pour un lead déjà persisté en base (le lead
 *  n'est pas perdu, mais l'admin doit le voir dans les logs Cloudflare). */
function logAdminEmailFailure(kind: string, result: SendEmailResult): void {
  if (result.ok) return
  console.error(`notify ${kind}: admin email not sent`, {
    reason: result.reason,
    skipped: result.skipped,
  })
}

export async function notifyPartnerRequest(
  input: Omit<PartnerRequestEmailInput, 'adminUrl'>,
): Promise<void> {
  const full: PartnerRequestEmailInput = {
    ...input,
    adminUrl: `${SITE_URL}/admin?tab=partners`,
  }

  const admin = buildPartnerRequestAdminEmail(full)
  logAdminEmailFailure(
    'partner request',
    await sendEmail({
      to: getAdminNotificationEmail(),
      subject: admin.subject,
      html: admin.html,
      text: admin.text,
      replyTo: input.contactEmail,
    }),
  )

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
  logAdminEmailFailure(
    'stock request',
    await sendEmail({
      to: getAdminNotificationEmail(),
      subject: admin.subject,
      html: admin.html,
      text: admin.text,
      replyTo: input.contactEmail,
    }),
  )

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

export async function notifyReportAccessRequest(
  input: Omit<ReportAccessRequestEmailInput, 'adminUrl'>,
): Promise<void> {
  const admin = buildReportAccessAdminEmail({
    ...input,
    adminUrl: `${SITE_URL}/admin?tab=quality`,
  })
  logAdminEmailFailure(
    'report access',
    await sendEmail({
      to: getAdminNotificationEmail(),
      subject: admin.subject,
      html: admin.html,
      text: admin.text,
      replyTo: input.email,
    }),
  )
}

export async function notifyReportAccessApproved(input: {
  readonly firstName: string
  readonly email: string
}): Promise<void> {
  const message = buildReportAccessApprovedEmail({
    ...input,
    qualityUrl: `${SITE_URL}/qualite`,
  })
  await sendEmail({
    to: input.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: getAdminNotificationEmail(),
  })
}

// Un message de contact n'existe QUE par email (aucune table en base) : si
// l'email admin ne part pas — Brevo absent ou en erreur — le lead serait perdu
// en silence derrière un « Message envoyé ». On lève donc une erreur pour que
// /api/contact réponde 503 et que l'UI propose l'adresse mail directe.
export async function notifyContactMessage(
  input: ContactEmailInput,
): Promise<void> {
  const admin = buildContactAdminEmail(input)
  const adminResult = await sendEmail({
    to: getAdminNotificationEmail(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
    replyTo: input.email,
  })
  if (!adminResult.ok) {
    throw new Error(`contact admin email not sent: ${adminResult.reason}`)
  }

  // L'accusé de réception au demandeur est secondaire : l'admin a le lead.
  const confirmation = buildContactConfirmationEmail(input)
  const confirmationResult = await sendEmail({
    to: input.email,
    subject: confirmation.subject,
    html: confirmation.html,
    text: confirmation.text,
    replyTo: getAdminNotificationEmail(),
  })
  if (!confirmationResult.ok) {
    console.error('notify contact: confirmation email not sent', {
      reason: confirmationResult.reason,
    })
  }
}
