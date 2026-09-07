import { describe, expect, it, vi } from 'vitest'

import { createStudioEventTracker } from './events-client'
import { MAX_EVENTS_PER_BATCH, STUDIO_EVENT_TYPES, parseStudioEventsBatch, type StudioEventsBatch } from './events'
import { buildStudioEventRows } from './events-server'

describe('contrat des événements Studio', () => {
  it('liste strictement les types autorisés, project_completed compris mais réservé', () => {
    expect(STUDIO_EVENT_TYPES).toEqual([
      'studio_started',
      'card_liked',
      'card_disliked',
      'card_passed',
      'undo',
      'favorite_added',
      'favorite_removed',
      'finalists_viewed',
      'seat_selected',
      'quantity_changed',
      'project_completed',
    ])
    expect(MAX_EVENTS_PER_BATCH).toBe(20)
  })

  it('accepte un lot minimal et refuse toute clé inconnue', () => {
    const ok = parseStudioEventsBatch({
      sessionId: 's-abcdefgh',
      algorithmVersion: 'v0.1',
      events: [{ type: 'card_passed', productId: 'p' }],
    })
    expect(ok.ok).toBe(true)
    const pii = parseStudioEventsBatch({
      sessionId: 's-abcdefgh',
      algorithmVersion: 'v0.1',
      events: [{ type: 'card_passed', productId: 'p', payload: { note: 'x' } }],
    })
    expect(pii.ok).toBe(false)
    expect(pii.error).toContain('payload')
  })

  it('construit des lignes sans PII, version portée par chaque ligne', () => {
    const batch: StudioEventsBatch = {
      sessionId: 's-abcdefgh',
      algorithmVersion: 'v0.1',
      events: [{ type: 'seat_selected', productId: 'p', variantId: 'v', payload: { quantity: 6 } }],
    }
    const rows = buildStudioEventRows(batch)
    expect(rows).toEqual([
      {
        session_id: 's-abcdefgh',
        event_type: 'seat_selected',
        product_id: 'p',
        variant_id: 'v',
        algorithm_version: 'v0.1',
        payload: { quantity: 6 },
        client_ts: null,
      },
    ])
  })
})

describe('traqueur client', () => {
  it('regroupe, découpe par 20 et porte la version et la session', async () => {
    const sent: StudioEventsBatch[] = []
    const tracker = createStudioEventTracker({
      sessionId: 's-abcdefgh',
      entry: 'seats',
      send: async (batch) => {
        sent.push(batch)
      },
      debounceMs: 0,
      now: () => new Date('2026-09-08T10:00:00.000Z'),
    })
    for (let index = 0; index < 25; index += 1) tracker.track('card_passed', { productId: `p-${index}` })
    await tracker.flush()
    expect(tracker.pending()).toBe(0)
    expect(sent.length).toBeGreaterThanOrEqual(2)
    expect(sent.reduce((sum, batch) => sum + batch.events.length, 0)).toBe(25)
    for (const batch of sent) {
      expect(batch.events.length).toBeLessThanOrEqual(20)
      expect(batch.algorithmVersion).toBe('v0.1')
      expect(batch.sessionId).toBe('s-abcdefgh')
      expect(batch.entry).toBe('seats')
      for (const event of batch.events) expect(event.clientTs).toBe('2026-09-08T10:00:00.000Z')
    }
  })

  it('keepalive uniquement au vidage de fermeture de page', async () => {
    const calls: Array<{ keepalive?: boolean } | undefined> = []
    const tracker = createStudioEventTracker({
      sessionId: 's-abcdefgh',
      send: async (_batch, options) => {
        calls.push(options)
      },
      debounceMs: 10_000,
    })
    tracker.track('card_passed', { productId: 'p' })
    await tracker.flush()
    tracker.track('card_passed', { productId: 'q' })
    await tracker.flush({ keepalive: true })
    expect(calls.map((options) => options?.keepalive === true)).toEqual([false, true])
  })

  it('un envoi qui échoue est silencieux et ne rejette jamais', async () => {
    const send = vi.fn(async () => {
      throw new Error('network down')
    })
    const tracker = createStudioEventTracker({ sessionId: 's-abcdefgh', send, debounceMs: 0 })
    expect(() => tracker.track('studio_started', { payload: { entry: 'seats' } })).not.toThrow()
    await expect(tracker.flush()).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('ignore un payload vide et n’envoie rien sans événement', async () => {
    const sent: StudioEventsBatch[] = []
    const send = vi.fn(async (batch: StudioEventsBatch) => {
      sent.push(batch)
    })
    const tracker = createStudioEventTracker({ sessionId: 's-abcdefgh', send, debounceMs: 0 })
    await tracker.flush()
    expect(send).not.toHaveBeenCalled()
    tracker.track('undo', { payload: {} })
    await tracker.flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(sent[0]?.events[0]).not.toHaveProperty('payload')
  })
})

it('sérialise réellement les flush, garde ordre et keepalive même après erreur', async () => {
  let rejectFirst!: (error: Error) => void
  const first = new Promise<void>((_resolve, reject) => { rejectFirst = reject })
  const send = vi.fn().mockImplementationOnce(() => first).mockResolvedValue(undefined)
  const tracker = createStudioEventTracker({ sessionId: 's-abcdefgh', send, debounceMs: 10000 })
  tracker.track('card_liked', { productId: 'a' })
  const one = tracker.flush()
  await Promise.resolve()
  expect(send).toHaveBeenCalledTimes(1)
  tracker.track('card_passed', { productId: 'b' })
  const two = tracker.flush({ keepalive: true })
  await Promise.resolve()
  expect(send).toHaveBeenCalledTimes(1)
  rejectFirst(new Error('network'))
  await Promise.all([one, two, tracker.flush()])
  expect(send).toHaveBeenCalledTimes(2)
  expect(send.mock.calls.map(([batch]) => batch.events[0].productId)).toEqual(['a', 'b'])
  expect(send.mock.calls[1]?.[1]).toEqual({ keepalive: true })
  expect(tracker.pending()).toBe(0)
})
