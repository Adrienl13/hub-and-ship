import { describe, expect, it, vi } from 'vitest'

import { handleContactMessage } from './contact'

function createRequest(body: unknown, origin?: string): Request {
  return new Request('https://prosimport.com/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  name: 'Restaurant Audit',
  email: 'ACHAT@restaurant-audit.fr',
  company: 'Restaurant Audit',
  topic: 'produit',
  message: 'Bonjour, je souhaite un devis pour 60 chaises.',
}

describe('contact API route', () => {
  it('notifies and answers 201 when the email goes out', async () => {
    const notify = vi.fn(async () => undefined)

    const response = await handleContactMessage(
      createRequest(VALID_BODY),
      notify,
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'achat@restaurant-audit.fr',
        topicLabel: 'Produit / catalogue',
      }),
    )
  })

  it('answers 503 (never a false success) when the admin email cannot be sent', async () => {
    const notify = vi.fn(async () => {
      throw new Error('contact admin email not sent: not_configured')
    })

    const response = await handleContactMessage(
      createRequest(VALID_BODY),
      notify,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Envoi impossible pour le moment',
    })
  })

  it('rejects an invalid payload with 400 before notifying', async () => {
    const notify = vi.fn(async () => undefined)

    const response = await handleContactMessage(
      createRequest({ ...VALID_BODY, message: 'court' }),
      notify,
    )

    expect(response.status).toBe(400)
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects a cross-origin browser submission', async () => {
    const notify = vi.fn(async () => undefined)

    const response = await handleContactMessage(
      createRequest(VALID_BODY, 'https://evil.example'),
      notify,
    )

    expect(response.status).toBe(403)
    expect(notify).not.toHaveBeenCalled()
  })
})
