// Brevo (ex-Sendinblue) transactional email wrapper. Server-only. Brevo exposes
// an HTTP API, which works on Cloudflare Workers (unlike SMTP). The API key is
// read from process.env, never from import.meta.env, so it is not exposed to
// the client. When BREVO_API_KEY is absent every send is a graceful no-op
// (skipped) rather than an error.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'
const FALLBACK_SENDER_NAME = 'Container Club'
const FALLBACK_SENDER_EMAIL = 'contact@terrassea.com'

export function isEmailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY)
}

interface Sender {
  readonly name: string
  readonly email: string
}

/** Parses `BREVO_FROM` ("Name <email>" or "email") into a Brevo sender. */
export function getSender(): Sender {
  const raw = process.env.BREVO_FROM?.trim()
  if (raw) {
    const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
    if (match) {
      const email = match[2]!.trim()
      if (email) {
        return { name: match[1]?.trim() || FALLBACK_SENDER_NAME, email }
      }
    }
    if (raw.includes('@')) {
      return { name: FALLBACK_SENDER_NAME, email: raw }
    }
  }
  return { name: FALLBACK_SENDER_NAME, email: FALLBACK_SENDER_EMAIL }
}

/** Display string of the configured sender (kept for compatibility). */
export function getEmailFrom(): string {
  const sender = getSender()
  return `${sender.name} <${sender.email}>`
}

export function getAdminNotificationEmail(): string {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || 'adrienlaniez1@gmail.com'
  )
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
  | {
      readonly ok: false
      readonly skipped: true
      readonly reason: 'not_configured'
    }
  | { readonly ok: false; readonly skipped: false; readonly reason: string }

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'not_configured' }
  }

  const recipients = (
    Array.isArray(input.to) ? input.to : [input.to as string]
  ).map((email) => ({ email }))

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: getSender(),
        to: recipients,
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        ...(input.replyTo ? { replyTo: { email: input.replyTo } } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const reason = `brevo_${response.status}: ${detail.slice(0, 300)}`
      console.error('sendEmail: Brevo rejected', {
        to: input.to,
        subject: input.subject,
        reason,
      })
      return { ok: false, skipped: false, reason }
    }

    const data = (await response.json().catch(() => ({}))) as {
      messageId?: string
    }
    console.info('sendEmail: sent', {
      to: input.to,
      subject: input.subject,
      id: data.messageId ?? 'unknown',
    })
    return { ok: true, id: data.messageId ?? 'unknown' }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown_error'
    console.error('sendEmail: transport error', {
      to: input.to,
      subject: input.subject,
      reason,
    })
    return { ok: false, skipped: false, reason }
  }
}
