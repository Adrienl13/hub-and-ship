// Moteur V0 (lot 2) : nextCard(state, catalogue, version).
//
// 1. Candidats = assises discovery_ready jamais décidées dans l'historique.
// 2. Ordre de base = round-robin matière puis sous-type, seedé par sessionId
//    (initialOrder). Cet ordre sert de départage et de séquence initiale.
// 3. Sans signal (aucun j'aime / pas pour moi), la carte suivante est la
//    première de l'ordre de base : diversité garantie dès le départ.
// 4. Avec signaux, chaque candidat reçoit affinité + nouveauté + répétition ;
//    le meilleur gagne (départage par l'ordre de base).
// 5. Exploration ε = 0.2 : un tirage seedé (sessionId + position) remplace
//    parfois le meilleur par un candidat pris au hasard parmi les autres.
// Le prix n'est jamais lu : EngineSeat ne le contient pas.

import { interleaveByDiversity } from './diversity'
import { affinityFromHistory, scoreCandidate } from './scoring'
import { createSeededRandom, hashSeed } from './seed'
import type { EngineCatalogue, EngineSeat, EngineState } from './types'

export const ALGORITHM_VERSION = 'v0.1' as const
export type AlgorithmVersion = typeof ALGORITHM_VERSION

export const EXPLORATION_RATE = 0.2

export type NextCardReason = 'initial' | 'score' | 'exploration'

export interface NextCard {
  readonly productId: string
  readonly reason: NextCardReason
  /** Position (0-based) dans la session = taille de l'historique. */
  readonly position: number
  readonly algorithmVersion: AlgorithmVersion
}

export function initialOrder(
  sessionId: string,
  seats: ReadonlyArray<EngineSeat>,
): ReadonlyArray<EngineSeat> {
  return interleaveByDiversity(seats, createSeededRandom(hashSeed(`${sessionId}:order`)))
}

export function remainingCandidates(
  state: EngineState,
  seats: ReadonlyArray<EngineSeat>,
): ReadonlyArray<EngineSeat> {
  const decided = new Set(state.history.map((interaction) => interaction.productId))
  return seats.filter((seat) => !decided.has(seat.id))
}

export function nextCard(
  state: EngineState,
  catalogue: EngineCatalogue,
  version: AlgorithmVersion = ALGORITHM_VERSION,
): NextCard | null {
  const ordered = initialOrder(state.sessionId, catalogue.seats)
  const candidates = remainingCandidates(state, ordered)
  if (candidates.length === 0) return null
  const position = state.history.length

  const seatsById = new Map(catalogue.seats.map((seat) => [seat.id, seat] as const))
  const hasSignal = state.history.some((interaction) => interaction.action !== 'pass')
  if (!hasSignal) {
    return { productId: candidates[0]!.id, reason: 'initial', position, algorithmVersion: version }
  }

  const shown = state.history
    .map((interaction) => seatsById.get(interaction.productId))
    .filter((seat): seat is EngineSeat => seat !== undefined)
  const affinity = affinityFromHistory(state.history, seatsById)
  const ranked = candidates
    .map((seat, rank) => ({ seat, rank, score: scoreCandidate(seat, affinity, shown) }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank)

  const random = createSeededRandom(hashSeed(`${state.sessionId}:explore:${position}`))
  if (ranked.length > 1 && random() < EXPLORATION_RATE) {
    const others = ranked.slice(1)
    const pick = others[Math.floor(random() * others.length)]!
    return { productId: pick.seat.id, reason: 'exploration', position, algorithmVersion: version }
  }
  return { productId: ranked[0]!.seat.id, reason: 'score', position, algorithmVersion: version }
}
