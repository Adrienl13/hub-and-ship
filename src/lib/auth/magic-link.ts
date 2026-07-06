// Server-only: generate a Supabase magic sign-in link for a guest buyer so the
// payment-confirmation email can actually deliver the "magic link envoyé après
// paiement réussi" promised at checkout. The account is created on the fly
// (email pre-confirmed — the address just paid via Stripe) and the guest's
// reservations get attached on first visit by the claim_my_reservations RPC.

export interface MagicLinkAdminClient {
  auth: {
    admin: {
      generateLink: (params: {
        type: 'magiclink'
        email: string
        options?: { redirectTo?: string }
      }) => Promise<{
        data: { properties: { action_link: string } | null } | null
        error: { message: string } | null
      }>
      createUser: (params: {
        email: string
        email_confirm: boolean
      }) => Promise<{ error: { message: string } | null }>
    }
  }
}

/**
 * Returns a one-time sign-in URL for `email`, or null when the link cannot be
 * generated (auth misconfigured, invalid email…). Never throws — the caller
 * (Stripe webhook) must always ack the event, link or not.
 */
export async function createAccountAccessLink({
  client,
  email,
  redirectTo,
}: {
  readonly client: MagicLinkAdminClient
  readonly email: string
  readonly redirectTo: string
}): Promise<string | null> {
  try {
    const first = await client.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
    const firstLink = first.data?.properties?.action_link
    if (!first.error && firstLink) return firstLink

    // Most likely "user not found": create the account (email confirmed — it
    // just completed a Stripe payment) and retry once.
    const created = await client.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (created.error) return null

    const second = await client.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })
    return second.error ? null : (second.data?.properties?.action_link ?? null)
  } catch {
    return null
  }
}
