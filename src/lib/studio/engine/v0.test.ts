import { describe, expect, it } from 'vitest'

import { seat } from '../fixtures.test-helpers'
import type { SeatKind, SeatMaterial } from '../types'
import {
  ALGORITHM_VERSION,
  MAX_FINALISTS,
  affinityFromHistory,
  emptyAffinity,
  findDiagnosticDuel,
  initialOrder,
  interleaveByDiversity,
  moreFinalistCandidates,
  nextCard,
  noveltyBonus,
  repetitionPenalty,
  scoreCandidate,
  selectFinalists,
  toEngineSeat,
  type EngineCatalogue,
  type EngineSeat,
  type EngineState,
  type Interaction,
} from './index'
import { createSeededRandom, hashSeed } from './seed'
import { EXPLORATION_RATE } from './v0'

const MATERIALS: ReadonlyArray<SeatMaterial> = ['pe_weave', 'rope', 'textilene']
const KINDS: ReadonlyArray<SeatKind> = ['chair', 'armchair']

/** 24 assises : 3 matières × 2 sous-types × 4, familles null. */
function buildSeats(count = 24): EngineSeat[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `seat-${index}`,
    material: MATERIALS[index % MATERIALS.length]!,
    seatKind: KINDS[Math.floor(index / MATERIALS.length) % KINDS.length]!,
    familyId: null,
  }))
}

function catalogue(seats: ReadonlyArray<EngineSeat> = buildSeats()): EngineCatalogue {
  return { seats, diagnosticPairs: [] }
}

function state(history: ReadonlyArray<Interaction> = [], sessionId = 'session-A'): EngineState {
  return { sessionId, history }
}

/** Joue une session complète avec une politique d'action donnée. */
function playSequence(
  sessionId: string,
  cat: EngineCatalogue,
  policy: (productId: string, index: number) => Interaction['action'],
  steps = 12,
): string[] {
  const history: Interaction[] = []
  const sequence: string[] = []
  for (let index = 0; index < steps; index += 1) {
    const card = nextCard(state(history, sessionId), cat)
    if (!card) break
    sequence.push(card.productId)
    history.push({ productId: card.productId, action: policy(card.productId, index) })
  }
  return sequence
}

const seatsById = (seats: ReadonlyArray<EngineSeat>) => new Map(seats.map((s) => [s.id, s] as const))

describe('moteur V0 — version et déterminisme', () => {
  it('expose une version explicite portée par chaque carte', () => {
    expect(ALGORITHM_VERSION).toBe('v0.1')
    const card = nextCard(state(), catalogue())
    expect(card?.algorithmVersion).toBe('v0.1')
    expect(card?.position).toBe(0)
  })

  it('même session + même historique = même séquence, session différente = séquence différente', () => {
    const cat = catalogue()
    const alternate = (_: string, index: number) => (index % 3 === 0 ? 'like' : index % 3 === 1 ? 'dislike' : 'pass') as Interaction['action']
    const first = playSequence('session-A', cat, alternate)
    const again = playSequence('session-A', cat, alternate)
    const other = playSequence('session-B', cat, alternate)
    expect(again).toEqual(first)
    expect(other).not.toEqual(first)
    expect(new Set(first).size).toBe(first.length)
  })

  it("le générateur seedé est reproductible et n'utilise pas Math.random", () => {
    const a = createSeededRandom(hashSeed('x'))
    const b = createSeededRandom(hashSeed('x'))
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(hashSeed('x')).not.toBe(hashSeed('y'))
  })

  it('renvoie null quand toutes les assises ont été décidées', () => {
    const seats = buildSeats(3)
    const history = seats.map((s) => ({ productId: s.id, action: 'pass' as const }))
    expect(nextCard(state(history), catalogue(seats))).toBeNull()
  })
})

describe('moteur V0 — diversité initiale', () => {
  it('alterne les matières puis les sous-types dès le départ (round-robin)', () => {
    const ordered = initialOrder('session-A', buildSeats())
    const firstThree = ordered.slice(0, 3).map((s) => s.material)
    expect(new Set(firstThree).size).toBe(3)
    // Dans chaque matière, les sous-types alternent.
    const peWeave = ordered.filter((s) => s.material === 'pe_weave').slice(0, 2).map((s) => s.seatKind)
    expect(new Set(peWeave).size).toBe(2)
    expect(ordered).toHaveLength(24)
    expect(new Set(ordered.map((s) => s.id)).size).toBe(24)
  })

  it('sans aucun signal, les 6 premières cartes couvrent les 3 matières et les 2 sous-types', () => {
    const sequence = playSequence('session-C', catalogue(), () => 'pass', 6)
    const seats = seatsById(buildSeats())
    const materials = new Set(sequence.map((id) => seats.get(id)!.material))
    const kinds = new Set(sequence.map((id) => seats.get(id)!.seatKind))
    expect(materials.size).toBe(3)
    expect(kinds.size).toBe(2)
  })

  it('interleaveByDiversity est déterministe pour un même seed', () => {
    const seats = buildSeats(9)
    const a = interleaveByDiversity(seats, createSeededRandom(7)).map((s) => s.id)
    const b = interleaveByDiversity(seats, createSeededRandom(7)).map((s) => s.id)
    expect(a).toEqual(b)
  })
})

describe('moteur V0 — signaux', () => {
  const seats = buildSeats()
  const byId = seatsById(seats)

  it("un j'aime augmente l'affinité de la matière, du sous-type (famille null ignorée)", () => {
    const liked = seats[0]!
    const affinity = affinityFromHistory([{ productId: liked.id, action: 'like' }], byId)
    expect(affinity.material.get(liked.material!)).toBe(1)
    expect(affinity.seatKind.get(liked.seatKind!)).toBe(1)
    expect(affinity.family.size).toBe(0)
  })

  it("un « pas pour moi » vaut −1, « passer » ne pèse rien", () => {
    const first = seats[0]!
    const affinity = affinityFromHistory(
      [
        { productId: first.id, action: 'dislike' },
        { productId: seats[3]!.id, action: 'pass' },
      ],
      byId,
    )
    expect(affinity.material.get(first.material!)).toBe(-1)
    expect(affinity.material.get(seats[3]!.material!)).toBe(-1)
    expect(affinity.material.get('rope')).toBeUndefined()
    const passOnly = affinityFromHistory([{ productId: first.id, action: 'pass' }], byId)
    expect(passOnly.material.size).toBe(0)
    expect(passOnly.seatKind.size).toBe(0)
  })

  it("après un j'aime sur pe_weave/chair, la carte suivante (hors exploration) partage la matière ou le sous-type", () => {
    const cat = catalogue(seats)
    const first = nextCard(state(), cat)!
    const likedSeat = byId.get(first.productId)!
    const history: Interaction[] = [{ productId: first.productId, action: 'like' }]
    // Cherche la première position sans exploration pour un test stable.
    let card = nextCard(state(history), cat)!
    while (card.reason === 'exploration') {
      history.push({ productId: card.productId, action: 'pass' })
      card = nextCard(state(history), cat)!
    }
    const next = byId.get(card.productId)!
    expect(card.reason).toBe('score')
    expect(next.material === likedSeat.material || next.seatKind === likedSeat.seatKind).toBe(true)
  })

  it('un « pas pour moi » fait reculer la matière rejetée dans le classement', () => {
    const cat = catalogue(seats)
    const first = nextCard(state(), cat)!
    const rejected = byId.get(first.productId)!
    const history: Interaction[] = [{ productId: first.productId, action: 'dislike' }]
    let card = nextCard(state(history), cat)!
    while (card.reason === 'exploration') {
      history.push({ productId: card.productId, action: 'pass' })
      card = nextCard(state(history), cat)!
    }
    expect(byId.get(card.productId)!.material).not.toBe(rejected.material)
  })

  it('malus de répétition : 3 cartes de suite de la même matière pénalisent la 4e', () => {
    const rope = seats.filter((s) => s.material === 'rope')
    const candidate = rope[3]!
    expect(repetitionPenalty(candidate, rope.slice(0, 3))).toBe(-1)
    expect(repetitionPenalty(candidate, [rope[0]!, rope[1]!, seats[0]!])).toBe(0)
    expect(repetitionPenalty(candidate, rope.slice(0, 2))).toBe(0)
    const family: EngineSeat = { id: 'f', material: null, seatKind: null, familyId: 'fam' }
    expect(repetitionPenalty(family, [family, family, family])).toBe(-1)
  })

  it('bonus de nouveauté : matière et sous-type jamais montrés', () => {
    expect(noveltyBonus(seats[0]!, [])).toBe(1)
    expect(noveltyBonus(seats[0]!, [seats[0]!])).toBe(0)
    expect(noveltyBonus(seats[1]!, [seats[0]!])).toBe(0.5)
    expect(scoreCandidate(seats[1]!, emptyAffinity(), [seats[0]!])).toBe(0.5)
  })

  it('exploration seedée ε = 0.2 : présente et reproductible, jamais majoritaire', () => {
    expect(EXPLORATION_RATE).toBe(0.2)
    const cat = catalogue(seats)
    const reasons: string[] = []
    const history: Interaction[] = [{ productId: seats[0]!.id, action: 'like' }]
    for (let index = 0; index < 20; index += 1) {
      const card = nextCard(state(history, 'session-explore'), cat)
      if (!card) break
      reasons.push(card.reason)
      history.push({ productId: card.productId, action: 'pass' })
    }
    const explored = reasons.filter((r) => r === 'exploration').length
    expect(explored).toBeGreaterThan(0)
    expect(explored).toBeLessThan(reasons.length / 2)
    const replay: string[] = []
    const replayHistory: Interaction[] = [{ productId: seats[0]!.id, action: 'like' }]
    for (let index = 0; index < 20; index += 1) {
      const card = nextCard(state(replayHistory, 'session-explore'), cat)
      if (!card) break
      replay.push(card.reason)
      replayHistory.push({ productId: card.productId, action: 'pass' })
    }
    expect(replay).toEqual(reasons)
  })
})

describe('moteur V0 — le prix est absent', () => {
  it('deux catalogues identiques à prix totalement différents donnent EXACTEMENT la même séquence', () => {
    const verified = new Set<string>()
    const cheap = Array.from({ length: 18 }, (_, index) =>
      toEngineSeat(
        seat(`p-${index}`, {
          basePriceHt: 10 + index,
          retailPriceRef: 20 + index,
          studio: {
            studioRole: 'seat',
            seatKind: KINDS[index % 2]!,
            material: MATERIALS[index % 3]!,
            modelFamilyId: null,
            visualTraits: null,
            dataQuality: {},
          },
        }),
        verified,
      ),
    )
    const expensive = Array.from({ length: 18 }, (_, index) =>
      toEngineSeat(
        seat(`p-${index}`, {
          basePriceHt: 5000 - index * 100,
          retailPriceRef: 9000,
          studio: {
            studioRole: 'seat',
            seatKind: KINDS[index % 2]!,
            material: MATERIALS[index % 3]!,
            modelFamilyId: null,
            visualTraits: null,
            dataQuality: {},
          },
        }),
        verified,
      ),
    )
    const policy = (_: string, index: number) => (index % 2 === 0 ? 'like' : 'dislike') as Interaction['action']
    expect(playSequence('session-price', catalogue(cheap), policy, 18)).toEqual(
      playSequence('session-price', catalogue(expensive), policy, 18),
    )
  })

  it("la projection moteur ne contient aucun champ de prix", () => {
    const projected = toEngineSeat(seat('x'), new Set())
    expect(Object.keys(projected).sort()).toEqual(['familyId', 'id', 'material', 'seatKind'])
  })
})

describe('moteur V0 — familles', () => {
  it('une famille non vérifiée est ignorée (null), une famille vérifiée est transmise', () => {
    const product = seat('fam', {
      studio: { studioRole: 'seat', seatKind: 'chair', material: 'rope', modelFamilyId: 'family-1', visualTraits: null, dataQuality: {} },
    })
    expect(toEngineSeat(product, new Set()).familyId).toBeNull()
    expect(toEngineSeat(product, new Set(['family-1'])).familyId).toBe('family-1')
  })

  it("une famille vérifiée aimée pèse +1 ; sans vérification elle ne pèse rien", () => {
    const a: EngineSeat = { id: 'a', material: 'rope', seatKind: 'chair', familyId: 'fam' }
    const b: EngineSeat = { id: 'b', material: 'pe_weave', seatKind: 'armchair', familyId: 'fam' }
    const affinity = affinityFromHistory([{ productId: 'a', action: 'like' }], seatsById([a, b]))
    expect(scoreCandidate(b, affinity, [a])).toBe(1 + 1)
    const aNoFamily: EngineSeat = { ...a, familyId: null }
    const bNoFamily: EngineSeat = { ...b, familyId: null }
    const none = affinityFromHistory([{ productId: 'a', action: 'like' }], seatsById([aNoFamily, bNoFamily]))
    expect(scoreCandidate(bNoFamily, none, [aNoFamily])).toBe(1)
  })
})

describe('moteur V0 — finalistes', () => {
  const seats = buildSeats()
  const byId = seatsById(seats)

  it('jamais plus de 3 finalistes, même avec 10 favoris', () => {
    const favorites = seats.slice(0, 10).map((s) => s.id)
    const affinity = affinityFromHistory(favorites.map((id) => ({ productId: id, action: 'like' as const })), byId)
    const selection = selectFinalists(favorites, affinity, byId)
    expect(MAX_FINALISTS).toBe(3)
    expect(selection.finalistIds).toHaveLength(3)
    expect(selection.remainingIds).toHaveLength(7)
    expect(new Set([...selection.finalistIds, ...selection.remainingIds]).size).toBe(10)
  })

  it("2 finalistes quand le troisième n'a pas de score positif ; jamais un troisième inventé", () => {
    // Deux favoris aimés (score > 0), un troisième favori dont la matière a
    // été rejetée par ailleurs (score ≤ 0).
    const liked = [seats[0]!, seats[3]!]
    const third = seats[1]!
    const disliked = seats.filter((s) => s.material === third.material && s.id !== third.id).slice(0, 2)
    const history: Interaction[] = [
      ...liked.map((s) => ({ productId: s.id, action: 'like' as const })),
      { productId: third.id, action: 'like' },
      ...disliked.map((s) => ({ productId: s.id, action: 'dislike' as const })),
    ]
    const affinity = affinityFromHistory(history, byId)
    const selection = selectFinalists([...liked.map((s) => s.id), third.id], affinity, byId)
    expect(selection.finalistIds).toHaveLength(2)
    expect(selection.finalistIds).not.toContain(third.id)
    expect(selection.remainingIds).toEqual([third.id])
  })

  it('un seul favori → un seul finaliste ; aucun favori → aucun', () => {
    const affinity = affinityFromHistory([{ productId: seats[0]!.id, action: 'like' }], byId)
    expect(selectFinalists([seats[0]!.id], affinity, byId).finalistIds).toEqual([seats[0]!.id])
    expect(selectFinalists([], affinity, byId).finalistIds).toEqual([])
  })

  it('« voir plus » propose 2 candidats supplémentaires sans dépasser 3 sélectionnés', () => {
    const favorites = seats.slice(0, 8).map((s) => s.id)
    const affinity = affinityFromHistory(favorites.map((id) => ({ productId: id, action: 'like' as const })), byId)
    const selection = selectFinalists(favorites, affinity, byId)
    const more = moreFinalistCandidates(selection, [])
    expect(more).toHaveLength(2)
    expect(more.every((id) => !selection.finalistIds.includes(id))).toBe(true)
    const next = moreFinalistCandidates(selection, more)
    expect(next).toHaveLength(2)
    expect(next.every((id) => !more.includes(id))).toBe(true)
    expect(selection.finalistIds).toHaveLength(3)
  })
})

describe('moteur V0 — duels', () => {
  it('aucun duel sans paire explicite, même activés', () => {
    expect(findDiagnosticDuel(['a', 'b', 'c'], [], { enabled: true })).toBeNull()
  })

  it('désactivés par défaut : une paire explicite ne suffit pas sans activation', () => {
    const pairs = [{ id: 'p1', productAId: 'a', productBId: 'b', axis: 'openness' }]
    expect(findDiagnosticDuel(['a', 'b'], pairs)).toBeNull()
    expect(findDiagnosticDuel(['a', 'b'], pairs, { enabled: false })).toBeNull()
  })

  it('duel uniquement si une paire explicite relie deux finalistes en présence', () => {
    const pairs = [
      { id: 'p1', productAId: 'a', productBId: 'z', axis: 'openness' },
      { id: 'p2', productAId: 'b', productBId: 'c', axis: 'edge_density' },
    ]
    expect(findDiagnosticDuel(['a', 'b'], pairs, { enabled: true })).toBeNull()
    expect(findDiagnosticDuel(['a', 'b', 'c'], pairs, { enabled: true })).toEqual({
      pairId: 'p2',
      axis: 'edge_density',
      leftId: 'b',
      rightId: 'c',
    })
  })
})
