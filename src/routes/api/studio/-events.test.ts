import { describe, expect, it, vi } from 'vitest'

import { createRateLimitStore } from '@/lib/security/rate-limit'
import { enforceApiRateLimit } from '@/lib/security/api-rate-limit'
import type { StudioEventInsert, StudioEventsClient, StudioSessionUpsert } from '@/lib/studio/events-server'

import { STUDIO_EVENTS_RATE_LIMIT, handleStudioEvents } from './events'

const VALID_BODY = {
  sessionId: '0f7d2c1e-6a0b-4c8e-9d1f-2b3c4d5e6f70',
  algorithmVersion: 'v0.1',
  entry: 'seats',
  events: [
    { type: 'studio_started', clientTs: '2026-09-08T10:00:00.000Z', payload: { entry: 'seats' } },
    { type: 'card_liked', productId: 'bis-001', payload: { position: 0, reason: 'initial' } },
    { type: 'quantity_changed', productId: 'bis-001', variantId: 'bis-001-std', payload: { quantity: 6 } },
  ],
}

function createRequest(body: unknown, init: { origin?: string; method?: string; ip?: string } = {}): Request {
  return new Request('https://prosimport.com/api/studio/events', {
    method: init.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.origin ? { origin: init.origin } : {}),
      ...(init.ip ? { 'cf-connecting-ip': init.ip } : {}),
    },
    body: init.method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function fakeClient(options: { sessionError?: string; insertError?: string } = {}) {
  const sessions: StudioSessionUpsert[] = []
  const events: StudioEventInsert[] = []
  const client = {
    from(table: 'studio_sessions' | 'studio_events') {
      return {
        upsert: async (values: StudioSessionUpsert) => {
          expect(table).toBe('studio_sessions')
          sessions.push(values)
          return { error: options.sessionError ? { message: options.sessionError } : null }
        },
        insert: async (values: ReadonlyArray<StudioEventInsert>) => {
          expect(table).toBe('studio_events')
          events.push(...values)
          return { error: options.insertError ? { message: options.insertError } : null }
        },
      }
    },
  }
  return { client: client as unknown as StudioEventsClient, sessions, events }
}

const allow = () => ({ allowed: true })

describe('POST /api/studio/events', () => {
  it('accepte un lot valide : session rafraîchie puis événements insérés avec la version', async () => {
    const fake = fakeClient()
    const response = await handleStudioEvents(createRequest(VALID_BODY), {
      client: () => fake.client,
      rateLimit: allow,
      now: () => new Date('2026-09-08T10:00:05.000Z'),
    })
    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ ok: true, inserted: 3 })
    expect(fake.sessions).toEqual([
      {
        id: VALID_BODY.sessionId,
        algorithm_version: 'v0.1',
        entry: 'seats',
        last_seen_at: '2026-09-08T10:00:05.000Z',
      },
    ])
    expect(fake.events).toHaveLength(3)
    expect(fake.events[1]).toEqual({
      session_id: VALID_BODY.sessionId,
      event_type: 'card_liked',
      product_id: 'bis-001',
      variant_id: null,
      algorithm_version: 'v0.1',
      payload: { position: 0, reason: 'initial' },
      client_ts: null,
    })
    expect(fake.events[2]?.payload).toEqual({ quantity: 6 })
    expect(fake.events[2]?.variant_id).toBe('bis-001-std')
  })

  it('refuse toute méthode autre que POST', async () => {
    const fake = fakeClient()
    const response = await handleStudioEvents(createRequest(null, { method: 'GET' }), {
      client: () => fake.client,
      rateLimit: allow,
    })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(fake.events).toHaveLength(0)
  })

  it('refuse une origine étrangère avant toute écriture', async () => {
    const fake = fakeClient()
    const response = await handleStudioEvents(createRequest(VALID_BODY, { origin: 'https://evil.example' }), {
      client: () => fake.client,
      rateLimit: allow,
    })
    expect(response.status).toBe(403)
    expect(fake.sessions).toHaveLength(0)
  })

  it.each([
    ['type inconnu', { ...VALID_BODY, events: [{ type: 'email_captured' }] }],
    ['clé de payload inconnue (PII)', { ...VALID_BODY, events: [{ type: 'card_liked', payload: { email: 'a@b.c' } }] }],
    ['clé de premier niveau inconnue', { ...VALID_BODY, userEmail: 'a@b.c' }],
    ['version invalide', { ...VALID_BODY, algorithmVersion: 'latest' }],
    ['session invalide', { ...VALID_BODY, sessionId: 'x' }],
    ['lot vide', { ...VALID_BODY, events: [] }],
    ['lot trop grand', { ...VALID_BODY, events: Array.from({ length: 21 }, () => ({ type: 'card_passed' })) }],
    ['quantité non entière', { ...VALID_BODY, events: [{ type: 'quantity_changed', payload: { quantity: 6.5 } }] }],
    ['JSON illisible', '{not json'],
  ])('refuse un payload invalide (%s) avec 400', async (_label, body) => {
    const fake = fakeClient()
    const response = await handleStudioEvents(createRequest(body), { client: () => fake.client, rateLimit: allow })
    expect(response.status).toBe(400)
    expect(fake.sessions).toHaveLength(0)
    expect(fake.events).toHaveLength(0)
  })

  it('applique le limiteur de débit par IP (60 lots / 10 min)', async () => {
    const fake = fakeClient()
    const store = createRateLimitStore()
    const rateLimit = (request: Request) =>
      enforceApiRateLimit(request, 'studio-events-test', STUDIO_EVENTS_RATE_LIMIT, store)
    expect(STUDIO_EVENTS_RATE_LIMIT).toEqual({ limit: 60, windowMs: 600_000 })
    let last = 0
    for (let index = 0; index < 60; index += 1) {
      last = (await handleStudioEvents(createRequest(VALID_BODY, { ip: '203.0.113.9' }), { client: () => fake.client, rateLimit })).status
    }
    expect(last).toBe(202)
    const blocked = await handleStudioEvents(createRequest(VALID_BODY, { ip: '203.0.113.9' }), { client: () => fake.client, rateLimit })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
    const other = await handleStudioEvents(createRequest(VALID_BODY, { ip: '203.0.113.10' }), { client: () => fake.client, rateLimit })
    expect(other.status).toBe(202)
  })

  it('répond 503 proprement quand le client admin est indisponible ou l’insertion échoue', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const missing = await handleStudioEvents(createRequest(VALID_BODY), {
      client: () => {
        throw new Error('Supabase admin client misconfigured')
      },
      rateLimit: allow,
    })
    expect(missing.status).toBe(503)
    await expect(missing.json()).resolves.toEqual({ ok: false, error: 'Mesure indisponible' })

    const failing = fakeClient({ insertError: 'relation does not exist' })
    const failed = await handleStudioEvents(createRequest(VALID_BODY), { client: () => failing.client, rateLimit: allow })
    expect(failed.status).toBe(503)
    const body = await failed.text()
    expect(body).not.toContain('relation does not exist')
    errorSpy.mockRestore()
  })
})
