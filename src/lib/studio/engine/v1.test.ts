import { describe, expect, it } from 'vitest'
import { evaluateConvergence } from './convergence'
import { nextCardV1, rankVisualSeats, selectVisualFinalists } from './v1'
import { assignStudioAlgorithm, V1_MODEL_VERSION } from './versions'
import type { EngineCatalogue, EngineState, Interaction } from './types'
import type { VisualNeighbor } from '../visual'

// 80 references, 8 measured fixture neighborhoods of 10; graph k=9 <=12.
export const catalogue: EngineCatalogue = {
  seats: Array.from({ length: 80 }, (_, i) => ({
    id: `p${String(i).padStart(2, '0')}`,
    material: null,
    seatKind: null,
    familyId: null,
  })),
  diagnosticPairs: [],
}
export const edges: VisualNeighbor[] = catalogue.seats.flatMap((a, i) =>
  catalogue.seats.flatMap((b, j) =>
    i !== j && Math.floor(i / 10) === Math.floor(j / 10)
      ? [
          {
            product_id: a.id,
            neighbor_product_id: b.id,
            rank: (j % 10) + 1,
            similarity: 0.94,
            model_version: V1_MODEL_VERSION,
          },
        ]
      : [],
  ),
)
const h = (
  productId: string,
  action: Interaction['action'] = 'like',
): Interaction => ({ productId, action })
const state = (history: Interaction[]): EngineState => ({
  sessionId: 'fixture-session',
  history,
})
const affinity = (history: Interaction[], id = 'p02') =>
  rankVisualSeats(state(history), catalogue, edges).ranked.find(
    (s) => s.id === id,
  )!.affinity
const coherent = [
  h('p00'),
  h('p01'),
  h('p20', 'dislike'),
  h('p30', 'dislike'),
  h('p40', 'dislike'),
]

describe('V1 pure, visuel et déterministe', () => {
  it('like rapproche ; dislike pénalise ; pass reste neutre', () => {
    expect(affinity([h('p00')])).toBeGreaterThan(affinity([]))
    expect(affinity([h('p00', 'dislike')])).toBeLessThan(affinity([]))
    expect(affinity([h('p00', 'pass')])).toBe(affinity([]))
  })
  it('faits commerciaux et prix ont exactement zéro effet', () => {
    const rich = {
      ...catalogue,
      seats: catalogue.seats.map((s, i) => ({
        ...s,
        price: i * 1000,
        basePriceHt: 1e9 - i,
        weight: 999,
        material: 'rope' as const,
      })),
    }
    expect(rankVisualSeats(state(coherent), rich, edges).ranked).toEqual(
      rankVisualSeats(state(coherent), catalogue, edges).ranked,
    )
    expect(evaluateConvergence(state(coherent), rich, edges)).toEqual(
      evaluateConvergence(state(coherent), catalogue, edges),
    )
  })
  it('proximité récente pénalisée séparément du goût', () => {
    const ranked = rankVisualSeats(state([h('p00')]), catalogue, edges).ranked
    const near = ranked.find((s) => s.id === 'p02')!
    expect(near.score).toBeLessThan(near.affinity)
  })
  it('exploration reproductible et accessibles même sans voisins', () => {
    const outputs = Array.from({ length: 100 }, (_, i) =>
      nextCardV1(
        { sessionId: `session-${i}`, history: [h('p00')] },
        catalogue,
        edges.filter(
          (e) => e.product_id !== 'p79' && e.neighbor_product_id !== 'p79',
        ),
      ),
    )
    expect(outputs.some((c) => c?.reason === 'exploration')).toBe(true)
    for (let i = 0; i < 100; i++)
      expect(
        nextCardV1(
          { sessionId: `session-${i}`, history: [h('p00')] },
          catalogue,
          edges.filter(
            (e) => e.product_id !== 'p79' && e.neighbor_product_id !== 'p79',
          ),
        ),
      ).toEqual(outputs[i])
    const allButLast = catalogue.seats.slice(0, -1).map((s) => h(s.id, 'pass'))
    expect(
      nextCardV1(
        state(allButLast),
        catalogue,
        edges.filter(
          (e) => e.product_id !== 'p79' && e.neighbor_product_id !== 'p79',
        ),
      )?.productId,
    ).toBe('p79')
  })
  it('deux directions distinctes ne sont pas moyennées', () => {
    const ranking = rankVisualSeats(
      state([h('p00'), h('p01'), h('p10'), h('p11')]),
      catalogue,
      edges,
    )
    expect(ranking.clusters).toEqual([
      ['p00', 'p01'],
      ['p10', 'p11'],
    ])
    expect(
      ranking.ranked.find((s) => s.id === 'p02')!.affinity,
    ).toBeGreaterThan(0.8)
    expect(
      ranking.ranked.find((s) => s.id === 'p12')!.affinity,
    ).toBeGreaterThan(0.8)
    const selected = selectVisualFinalists(
      ['p00', 'p01', 'p10', 'p11'],
      ranking,
    ).finalistIds
    expect(selected.length).toBeLessThanOrEqual(3)
    expect(selected.some((id) => id.startsWith('p0'))).toBe(true)
    expect(selected.some((id) => id.startsWith('p1'))).toBe(true)
  })
  it('sans données aucun écran vide, sans mutation', () => {
    const input = state(coherent),
      before = JSON.stringify({ input, catalogue, edges })
    expect(nextCardV1(input, catalogue, [])).not.toBeNull()
    rankVisualSeats(input, catalogue, edges)
    evaluateConvergence(input, catalogue, edges)
    expect(JSON.stringify({ input, catalogue, edges })).toBe(before)
  })
  it('attribution preview uniquement et reproductible', () => {
    expect(assignStudioAlgorithm('s', 'public', 'v1')).toBe('v0.1')
    expect(assignStudioAlgorithm('s', 'preview', 'v1')).toBe('v1.0')
    expect(assignStudioAlgorithm('s', 'preview', 'compare')).toBe(
      assignStudioAlgorithm('s', 'preview', 'compare'),
    )
  })
})
describe('Convergence adaptative sur 80 références', () => {
  it('signal cohérent ready bien avant épuisement', () => {
    const result = evaluateConvergence(state(coherent), catalogue, edges)
    expect(result.state, JSON.stringify(result)).toBe('ready')
    expect(coherent.length).toBeLessThan(catalogue.seats.length / 4)
  })
  it('signal insuffisant reste insuffisant', () =>
    expect(evaluateConvergence(state([h('p00')]), catalogue, edges).state).toBe(
      'insufficient_signal',
    ))
  it('passes seuls jamais ready et exploration longue stalled', () => {
    for (let i = 0; i <= 30; i++)
      expect(
        evaluateConvergence(
          state(catalogue.seats.slice(0, i).map((s) => h(s.id, 'pass'))),
          catalogue,
          edges,
        ).state,
      ).not.toBe('ready')
    expect(
      evaluateConvergence(
        state(catalogue.seats.slice(0, 14).map((s) => h(s.id, 'pass'))),
        catalogue,
        edges,
      ).state,
    ).toBe('stalled')
  })
  it('deux clusters stables peuvent converger', () => {
    const history = [
      h('p00'),
      h('p01'),
      h('p10'),
      h('p11'),
      h('p20', 'dislike'),
      h('p30', 'dislike'),
      h('p40', 'dislike'),
    ]
    const result = evaluateConvergence(state(history), catalogue, edges)
    expect(result.state, JSON.stringify(result)).toBe('ready')
    expect(result.metrics.clusters).toBe(2)
  })
  it('ranking instable continue et Undo recalcule exactement', () => {
    const history = [h('p00'), h('p10'), h('p20'), h('p30')]
    expect(evaluateConvergence(state(history), catalogue, edges).state).toBe(
      'insufficient_signal',
    )
    const initial = evaluateConvergence(
      state(coherent.slice(0, 1)),
      catalogue,
      edges,
    )
    evaluateConvergence(state(coherent), catalogue, edges)
    expect(
      evaluateConvergence(state(coherent.slice(0, 1)), catalogue, edges),
    ).toEqual(initial)
  })
  it('continuer après ready présente encore une carte et ne force aucun arrêt', () => {
    expect(evaluateConvergence(state(coherent), catalogue, edges).state).toBe(
      'ready',
    )
    const next = nextCardV1(state(coherent), catalogue, edges)
    expect(next).not.toBeNull()
    expect(coherent.some((s) => s.productId === next?.productId)).toBe(false)
  })
})

it('répéter le même like ne crée pas artificiellement quatre signaux', () => {
  const result = evaluateConvergence(
    state([h('p00'), h('p01'), h('p00'), h('p01'), h('p00')]),
    catalogue,
    edges,
  )
  expect(result.metrics.informative).toBe(2)
  expect(result.state).not.toBe('ready')
})
it('une similarité non finie ne donne aucune couverture V1', () => {
  expect(
    rankVisualSeats(
      state(coherent),
      catalogue,
      edges.map((e) => ({ ...e, similarity: NaN })),
    ).coverage,
  ).toBe(0)
})
