import { describe, expect, it } from 'vitest'

import {
  loadStudioUsage,
  summarizeStudioUsage,
  weekStartOf,
  type StudioUsageClient,
} from './admin-usage'

const NOW = new Date('2026-09-24T10:00:00Z') // jeudi → semaine du 2026-09-21

describe('weekStartOf', () => {
  it('ramène au lundi de la semaine, en UTC', () => {
    expect(weekStartOf('2026-09-24T10:00:00Z')).toBe('2026-09-21')
    expect(weekStartOf('2026-09-21T00:00:00Z')).toBe('2026-09-21')
    expect(weekStartOf('2026-09-27T23:59:59Z')).toBe('2026-09-21')
    expect(weekStartOf('2026-09-28T00:00:00Z')).toBe('2026-09-28')
  })

  it('renvoie null pour une date illisible', () => {
    expect(weekStartOf('pas une date')).toBeNull()
  })
})

describe('summarizeStudioUsage', () => {
  it('compte les sessions par semaine glissante, à zéro quand vides', () => {
    const summary = summarizeStudioUsage(
      {
        sessions: [
          { id: 's1', created_at: '2026-09-22T09:00:00Z' },
          { id: 's2', created_at: '2026-09-23T09:00:00Z' },
          { id: 's3', created_at: '2026-09-10T09:00:00Z' },
          // Trop ancienne pour la fenêtre : comptée au total, pas par semaine.
          { id: 's4', created_at: '2026-01-05T09:00:00Z' },
        ],
        events: [],
        products: [],
      },
      { now: NOW, weeks: 4 },
    )

    expect(summary.sessions).toBe(4)
    expect(summary.sessionsByWeek).toEqual([
      { weekStart: '2026-08-31', sessions: 0 },
      { weekStart: '2026-09-07', sessions: 1 },
      { weekStart: '2026-09-14', sessions: 0 },
      { weekStart: '2026-09-21', sessions: 2 },
    ])
  })

  it('répartit les décisions et classe les produits aimés et refusés par nom', () => {
    const summary = summarizeStudioUsage(
      {
        sessions: [{ id: 's1', created_at: '2026-09-22T09:00:00Z' }],
        events: [
          { session_id: 's1', event_type: 'card_liked', product_id: 'a' },
          { session_id: 's1', event_type: 'card_liked', product_id: 'a' },
          { session_id: 's1', event_type: 'card_liked', product_id: 'b' },
          { session_id: 's1', event_type: 'card_disliked', product_id: 'c' },
          { session_id: 's1', event_type: 'card_passed', product_id: 'b' },
          { session_id: 's1', event_type: 'card_passed', product_id: null },
          // Un like sans produit compte dans les décisions, pas au classement.
          { session_id: 's1', event_type: 'card_liked', product_id: null },
          { session_id: 's1', event_type: 'quantity_changed', product_id: 'a' },
        ],
        products: [
          { id: 'a', name: 'Fauteuil A' },
          { id: 'b', name: '  ' },
        ],
      },
      { now: NOW },
    )

    expect(summary.decisions).toEqual({ likes: 4, dislikes: 1, passes: 2 })
    expect(summary.topLiked).toEqual([
      { productId: 'a', name: 'Fauteuil A', count: 2 },
      { productId: 'b', name: 'b', count: 1 },
    ])
    // Produit inconnu du catalogue : l'identifiant sert de nom.
    expect(summary.topDisliked).toEqual([
      { productId: 'c', name: 'c', count: 1 },
    ])
  })

  it('limite les classements à dix produits, ex æquo départagés par identifiant', () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      session_id: 's1',
      event_type: 'card_liked',
      product_id: `p${String(i).padStart(2, '0')}`,
    }))
    const summary = summarizeStudioUsage(
      {
        sessions: [{ id: 's1', created_at: '2026-09-22T09:00:00Z' }],
        events: [
          ...events,
          { session_id: 's1', event_type: 'card_liked', product_id: 'p11' },
        ],
        products: [],
      },
      { now: NOW },
    )

    expect(summary.topLiked).toHaveLength(10)
    expect(summary.topLiked[0]).toEqual({
      productId: 'p11',
      name: 'p11',
      count: 2,
    })
    expect(summary.topLiked.map((p) => p.productId).slice(1)).toEqual([
      'p00',
      'p01',
      'p02',
      'p03',
      'p04',
      'p05',
      'p06',
      'p07',
      'p08',
    ])
  })

  it('mesure la part des sessions arrivées aux finalistes, une fois par session', () => {
    const summary = summarizeStudioUsage(
      {
        sessions: [
          { id: 's1', created_at: '2026-09-22T09:00:00Z' },
          { id: 's2', created_at: '2026-09-22T09:00:00Z' },
          { id: 's3', created_at: '2026-09-22T09:00:00Z' },
          { id: 's4', created_at: '2026-09-22T09:00:00Z' },
        ],
        events: [
          {
            session_id: 's1',
            event_type: 'finalists_viewed',
            product_id: null,
          },
          {
            session_id: 's1',
            event_type: 'finalists_viewed',
            product_id: null,
          },
          {
            session_id: 's2',
            event_type: 'finalists_viewed',
            product_id: null,
          },
          // Session purgée : ne gonfle pas le taux.
          {
            session_id: 'zz',
            event_type: 'finalists_viewed',
            product_id: null,
          },
        ],
        products: [],
      },
      { now: NOW },
    )

    expect(summary.sessionsReachingFinalists).toBe(2)
    expect(summary.finalistsRate).toBe(50)
  })

  it('reste à zéro sans aucune session', () => {
    const summary = summarizeStudioUsage(
      { sessions: [], events: [], products: [] },
      { now: NOW, weeks: 2 },
    )
    expect(summary.sessions).toBe(0)
    expect(summary.finalistsRate).toBe(0)
    expect(summary.sessionsByWeek).toHaveLength(2)
    expect(summary.topLiked).toEqual([])
  })
})

describe('loadStudioUsage', () => {
  function createClient(
    pages: Record<
      string,
      ReadonlyArray<ReadonlyArray<Record<string, unknown>>>
    >,
    errorTable?: string,
  ): { client: StudioUsageClient; calls: string[]; orders: string[] } {
    const calls: string[] = []
    const orders: string[] = []
    const client: StudioUsageClient = {
      from: (table) => ({
        select: (columns) => {
          const query = {
            order: (column: string, options: { ascending: boolean }) => {
              orders.push(
                `${table}:${column}:${options.ascending ? 'asc' : 'desc'}`,
              )
              return query
            },
            range: (from: number, to: number) => {
              calls.push(`${table}:${columns}:${from}-${to}`)
              if (errorTable === table) {
                return Promise.resolve({
                  data: null,
                  error: { message: 'Could not find the table' },
                })
              }
              const index = Math.floor(from / 1000)
              return Promise.resolve({
                data: pages[table]?.[index] ?? [],
                error: null,
              })
            },
          }
          return query
        },
      }),
    }
    return { client, calls, orders }
  }

  it('lit sessions, événements et noms produits page par page, colonnes explicites', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      session_id: 's1',
      event_type: i === 0 ? 'card_liked' : 'undo',
      product_id: i === 0 ? 'a' : null,
    }))
    const { client, calls, orders } = createClient({
      studio_sessions: [[{ id: 's1', created_at: '2026-09-22T09:00:00Z' }]],
      studio_events: [
        firstPage,
        [{ session_id: 's1', event_type: 'card_liked', product_id: 'a' }],
      ],
      products: [[{ id: 'a', name: 'Fauteuil A' }]],
    })

    const summary = await loadStudioUsage(client, { now: NOW })

    expect(summary.sessions).toBe(1)
    expect(summary.topLiked).toEqual([
      { productId: 'a', name: 'Fauteuil A', count: 2 },
    ])
    expect(calls).toEqual([
      'studio_sessions:id,created_at:0-999',
      'studio_events:session_id,event_type,product_id:0-999',
      'products:id,name:0-999',
      'studio_events:session_id,event_type,product_id:1000-1999',
    ])
    // Pagination stable : chaque page est triée par date puis id.
    expect(orders.slice(0, 2)).toEqual([
      'studio_sessions:created_at:asc',
      'studio_sessions:id:asc',
    ])
    expect(orders).toHaveLength(calls.length * 2)
  })

  it('remonte une erreur nommant la table', async () => {
    const { client } = createClient({}, 'studio_events')
    await expect(loadStudioUsage(client)).rejects.toThrow(
      /studio_events: Could not find the table/,
    )
  })
})
