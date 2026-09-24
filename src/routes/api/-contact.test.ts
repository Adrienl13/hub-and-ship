import { afterEach, describe, expect, it, vi } from 'vitest'

import { handleContactMessage } from './contact'

// Une IP par requête : la limite par IP (5 / 10 min) ne doit pas
// transformer un test de plus en 429.
let requestSeq = 0
function createRequest(body: unknown, origin?: string): Request {
  requestSeq += 1
  return new Request('https://terrassea.com/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.0.0.${requestSeq}`,
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  })
}

function createClient(error: { message: string } | null = null) {
  const insert = vi.fn(async () => ({ error }))
  const from = vi.fn((table: 'contact_requests') => {
    expect(table).toBe('contact_requests')
    return { insert }
  })
  return { client: { from }, insert }
}

const VALID_BODY = {
  name: 'Restaurant Audit',
  email: 'ACHAT@restaurant-audit.fr',
  company: 'Restaurant Audit',
  topic: 'produit',
  message: 'Bonjour, je souhaite un devis pour 60 chaises.',
}

afterEach(() => vi.restoreAllMocks())

describe('contact API route', () => {
  it('enregistre la demande en base puis notifie, 201 { ok: true }', async () => {
    const notify = vi.fn(async () => undefined)
    const { client, insert } = createClient()

    const response = await handleContactMessage(
      createRequest({
        ...VALID_BODY,
        attribution: { utm_source: 'meta', utm_campaign: 'terrasse-2026' },
      }),
      notify,
      client,
    )

    expect(response.status).toBe(201)
    // La réponse publique ne révèle pas l'état de la base.
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({
      topic: 'produit',
      source: 'contact_page',
      name: 'Restaurant Audit',
      email: 'achat@restaurant-audit.fr',
      company: 'Restaurant Audit',
      phone: null,
      message: 'Bonjour, je souhaite un devis pour 60 chaises.',
      product_sku: null,
      product_name: null,
      product_design: null,
      quantity: null,
      price_label: null,
      studio_brief: null,
      utm_source: 'meta',
      utm_medium: null,
      utm_campaign: 'terrasse-2026',
      partner_ref: null,
    })
    // L'ordre compte : base d'abord, email ensuite.
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(
      notify.mock.invocationCallOrder[0]!,
    )
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'achat@restaurant-audit.fr',
        topicLabel: 'Produit / catalogue',
      }),
    )
  })

  it('envoie quand même l’email (201) quand l’insertion échoue, sans faux 503', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const consoleWarn = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const notify = vi.fn(async () => undefined)
    const { client, insert } = createClient({ message: 'RLS denied' })

    const response = await handleContactMessage(
      createRequest(VALID_BODY),
      notify,
      client,
    )

    expect(response.status).toBe(201)
    // Même réponse publique qu'en cas de succès : l'échec de persistance
    // n'est visible que dans les logs serveur.
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(insert).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      'contact api: persistence failed',
      expect.any(Error),
    )
    expect(consoleWarn).toHaveBeenCalledWith(
      'contact api: contact request not persisted, email only',
    )
  })

  it('envoie quand même l’email quand le client Supabase lève avant l’insert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const notify = vi.fn(async () => undefined)
    const client = {
      from: vi.fn(() => {
        throw new Error('network down')
      }),
    }

    const response = await handleContactMessage(
      createRequest(VALID_BODY),
      notify,
      client,
    )

    expect(response.status).toBe(201)
    expect(notify).toHaveBeenCalledOnce()
  })

  it('transmet les champs produit du devis rapide en colonnes', async () => {
    const notify = vi.fn(async () => undefined)
    const { client, insert } = createClient()

    const response = await handleContactMessage(
      createRequest({
        ...VALID_BODY,
        topic: 'devis',
        source: 'catalogue_quick_quote',
        product: {
          sku: 'BIS-061',
          name: 'Fauteuil de bistrot MONTMARTRE',
          design: 'cannage rouge / crème',
          quantity: 50,
          priceLabel: '83,26 €',
        },
      }),
      notify,
      client,
    )

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'devis',
        source: 'catalogue_quick_quote',
        product_sku: 'BIS-061',
        product_name: 'Fauteuil de bistrot MONTMARTRE',
        product_design: 'cannage rouge / crème',
        quantity: 50,
        price_label: '83,26 €',
      }),
    )
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ topicLabel: 'Demande de devis' }),
    )
  })

  it('answers 503 (never a false success) when the admin email cannot be sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const notify = vi.fn(async () => {
      throw new Error('contact admin email not sent: not_configured')
    })
    const { client, insert } = createClient()

    const response = await handleContactMessage(
      createRequest(VALID_BODY),
      notify,
      client,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Envoi impossible pour le moment',
    })
    // La ligne est bien en base : l'admin la retrouve même sans email.
    expect(insert).toHaveBeenCalledOnce()
  })

  it('sans client (Supabase non configuré), notifie et répond 201 { ok: true }', async () => {
    const consoleWarn = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const notify = vi.fn(async () => undefined)

    const response = await handleContactMessage(
      createRequest(VALID_BODY),
      notify,
      null,
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(notify).toHaveBeenCalledOnce()
    expect(consoleWarn).toHaveBeenCalledWith(
      'contact api: contact request not persisted, email only',
    )
  })

  it('rejects an invalid payload with 400 before persisting or notifying', async () => {
    const notify = vi.fn(async () => undefined)
    const { client, insert } = createClient()

    const response = await handleContactMessage(
      createRequest({ ...VALID_BODY, message: 'court' }),
      notify,
      client,
    )

    expect(response.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects an unknown source with 400', async () => {
    const notify = vi.fn(async () => undefined)
    const { client, insert } = createClient()

    const response = await handleContactMessage(
      createRequest({ ...VALID_BODY, source: 'newsletter' }),
      notify,
      client,
    )

    expect(response.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects a cross-origin browser submission', async () => {
    const notify = vi.fn(async () => undefined)
    const { client, insert } = createClient()

    const response = await handleContactMessage(
      createRequest(VALID_BODY, 'https://evil.example'),
      notify,
      client,
    )

    expect(response.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })
})

it('transmet un projet Studio à confirmer : colonne dédiée + annexe email, source studio_brief', async () => {
  const notify = vi.fn(async () => undefined)
  const { client, insert } = createClient()
  const response = await handleContactMessage(
    createRequest({
      ...VALID_BODY,
      studioBrief: 'ROPE : bleu — Sur demande\nLogo demandé — À confirmer',
    }),
    notify,
    client,
  )
  expect(response.status).toBe(201)
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('ROPE : bleu — Sur demande'),
    }),
  )
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('DÉCLARATION CLIENT À REVALIDER'),
    }),
  )
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      source: 'studio_brief',
      studio_brief: 'ROPE : bleu — Sur demande\nLogo demandé — À confirmer',
    }),
  )
})
