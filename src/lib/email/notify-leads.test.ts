import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyContactMessage } from './notify-leads'

const INPUT = {
  name: 'Restaurant Audit',
  email: 'achat@restaurant-audit.fr',
  company: 'Restaurant Audit',
  phone: null,
  topicLabel: 'Produit / catalogue',
  message: 'Bonjour, je souhaite un devis pour 60 chaises.',
  attribution: null,
}

describe('notifyContactMessage', () => {
  const originalKey = process.env.BREVO_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.BREVO_API_KEY = originalKey
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('rejects when Brevo is not configured (the lead would be lost otherwise)', async () => {
    delete process.env.BREVO_API_KEY

    await expect(notifyContactMessage(INPUT)).rejects.toThrow(
      'contact admin email not sent: not_configured',
    )
  })

  it('rejects when Brevo refuses the admin email', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    globalThis.fetch = vi.fn(
      async () => new Response('unauthorized', { status: 401 }),
    ) as typeof fetch

    await expect(notifyContactMessage(INPUT)).rejects.toThrow(
      /contact admin email not sent: brevo_401/,
    )
  })

  it('resolves when the admin email is accepted, even if the acknowledgement fails', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-test'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messageId: 'admin-1' }), {
          status: 201,
        }),
      )
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(notifyContactMessage(INPUT)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith(
      'notify contact: confirmation email not sent',
      expect.objectContaining({ reason: expect.stringContaining('brevo_429') }),
    )
  })
})
