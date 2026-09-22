// Fin de découverte du moteur public (V0). Avant : neuf « j'aime » et rien —
// le Studio faisait défiler tout le catalogue. La règle, par compteurs,
// recalculée à chaque décision depuis l'historique (Undo exact).

import { describe, expect, it } from 'vitest'

import { V0_CONVERGENCE_POLICY, evaluateConvergenceV0 } from './convergence'
import type { EngineCatalogue, EngineState, Interaction } from './types'

const catalogue: EngineCatalogue = {
  seats: Array.from({ length: 30 }, (_, i) => ({
    id: `seat-${String(i + 1).padStart(2, '0')}`,
    material: (['rope', 'textilene', 'pe_weave'] as const)[i % 3]!,
    seatKind: (['chair', 'armchair', 'stool'] as const)[i % 3]!,
    familyId: null,
  })),
  diagnosticPairs: [],
}

const seat = (i: number) => `seat-${String(i).padStart(2, '0')}`
const state = (history: ReadonlyArray<Interaction>): EngineState => ({
  sessionId: 'session-test',
  history,
})
const decisions = (
  actions: ReadonlyArray<Interaction['action']>,
): Interaction[] =>
  actions.map((action, i) => ({ productId: seat(i + 1), action }))

describe('fin de découverte (V0)', () => {
  it('ne propose rien tant que les favoris ne suffisent pas', () => {
    expect(evaluateConvergenceV0(state([]), catalogue).state).toBe(
      'insufficient_signal',
    )
    const twoLikes = decisions(['like', 'dislike', 'like', 'pass', 'dislike'])
    expect(evaluateConvergenceV0(state(twoLikes), catalogue)).toMatchObject({
      state: 'insufficient_signal',
      metrics: { likes: 2, informative: 4 },
    })
  })

  it('propose de conclure à 3 favoris choisis parmi 6 décisions', () => {
    const five = decisions(['like', 'dislike', 'like', 'dislike', 'like'])
    expect(evaluateConvergenceV0(state(five), catalogue).state).toBe(
      'insufficient_signal',
    )
    const six = [...five, { productId: seat(6), action: 'dislike' as const }]
    expect(evaluateConvergenceV0(state(six), catalogue)).toMatchObject({
      state: 'ready',
      reasons: ['enough_favorites'],
      metrics: { likes: 3, informative: 6 },
    })
  })

  it('propose de conclure dès 5 favoris, même sans refus', () => {
    // Neuf « j'aime » d'affilée : le cas rapporté le 22/09.
    const nine = decisions(Array(9).fill('like'))
    const result = evaluateConvergenceV0(state(nine), catalogue)
    expect(result.state).toBe('ready')
    expect(result.metrics.likes).toBe(9)
    expect(V0_CONVERGENCE_POLICY.manyLikes).toBe(5)
    expect(
      evaluateConvergenceV0(state(decisions(Array(5).fill('like'))), catalogue)
        .state,
    ).toBe('ready')
  })

  it('un Undo retire la décision : l’état revient en arrière', () => {
    const six = decisions([
      'like',
      'dislike',
      'like',
      'dislike',
      'like',
      'dislike',
    ])
    expect(evaluateConvergenceV0(state(six), catalogue).state).toBe('ready')
    expect(
      evaluateConvergenceV0(state(six.slice(0, -1)), catalogue).state,
    ).toBe('insufficient_signal')
  })

  it('ne compte qu’une fois une assise revue', () => {
    const repeated = [
      ...decisions(['like', 'like', 'like']),
      { productId: seat(1), action: 'dislike' as const },
      { productId: seat(2), action: 'pass' as const },
    ]
    expect(
      evaluateConvergenceV0(state(repeated), catalogue).metrics,
    ).toMatchObject({
      likes: 1,
      informative: 2,
    })
  })

  it('cesse d’insister après 14 cartes sans favoris suffisants', () => {
    const fourteen = decisions(Array(14).fill('pass'))
    expect(evaluateConvergenceV0(state(fourteen), catalogue)).toMatchObject({
      state: 'stalled',
      reasons: ['insufficient_favorites', 'sparse_signal'],
    })
    expect(
      evaluateConvergenceV0(state(fourteen.slice(0, 13)), catalogue).state,
    ).toBe('insufficient_signal')
  })

  it('conclut de toute façon après 24 cartes', () => {
    const long = decisions([...Array(22).fill('pass'), 'like', 'like'])
    expect(evaluateConvergenceV0(state(long), catalogue)).toMatchObject({
      state: 'stalled',
      reasons: ['insufficient_favorites', 'discovery_too_long'],
    })
  })

  it('conclut quand tout le catalogue a été vu', () => {
    const all = decisions(Array(30).fill('pass'))
    const result = evaluateConvergenceV0(state(all), catalogue)
    expect(result.state).toBe('stalled')
    expect(result.reasons).toContain('catalogue_exhausted')
    expect(result.metrics.remainingNovelty).toBe(0)
  })

  it('ignore les décisions sur des assises hors catalogue', () => {
    const foreign: Interaction[] = Array.from({ length: 6 }, (_, i) => ({
      productId: `autre-${i}`,
      action: 'like',
    }))
    expect(evaluateConvergenceV0(state(foreign), catalogue)).toMatchObject({
      state: 'insufficient_signal',
      metrics: { likes: 0, informative: 0 },
    })
  })
})
