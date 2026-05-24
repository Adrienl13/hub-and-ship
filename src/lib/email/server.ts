// Resend wrapper. Server-only — never import from the browser bundle. The
// API key is read from process.env, never from `import.meta.env`, so it is
// not exposed to the client.

import { Resend } from 'resend'

const FALLBACK_FROM = 'Container Club <onboarding@resend.dev>'

let cachedClient: Resend | null = null

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function getEmailFrom(): string {
  return process.env.RESEND_FROM?.trim() || FALLBACK_FROM
}

export function getAdminNotificationEmail(): string {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || 'adrienlaniez1@gmail.com'
  )
}

function getResendClient(): Resend | null {
  if (!isEmailConfigured()) return null
  if (cachedClient) return cachedClient
  cachedClient = new Resend(process.env.RESEND_API_KEY!)
  return cachedClient
}

export interface SendEmailInput {
  readonly to: string | ReadonlyArray<string>
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: string
}

export type SendEmailResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly skipped: true; readonly reason: 'not_configured' }
  | { readonly ok: false; readonly skipped: false; readonly reason: string }

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResendClient()
  if (!client) {
    return { ok: false, skipped: true, reason: 'not_configured' }
  }

  try {
    const result = await client.emails.send({
      from: getEmailFrom(),
      to: Array.isArray(input.to) ? [...input.to] : [input.to as string],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })

    if (result.error) {
      return {
        ok: false,
        skipped: false,
        reason: result.error.message ?? 'resend_error',
      }
    }

    return { ok: true, id: result.data?.id ?? 'unknown' }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}
