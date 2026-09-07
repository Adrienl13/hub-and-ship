// Score V0 (lot 2) : +1 par j'aime, −1 par pas pour moi sur la matière, le
// sous-type et la famille VÉRIFIÉE correspondants ; « passer » = vu, poids 0.
// Le prix n'existe pas ici. Finalistes : 3 maximum, 2 acceptés, jamais un
// troisième inventé.

import { noveltyBonus, repetitionPenalty } from './diversity'
import type { EngineSeat, Interaction } from './types'

export interface Affinity {
  readonly material: ReadonlyMap<string, number>
  readonly seatKind: ReadonlyMap<string, number>
  readonly family: ReadonlyMap<string, number>
}

export function emptyAffinity(): Affinity {
  return { material: new Map(), seatKind: new Map(), family: new Map() }
}

function bump(map: Map<string, number>, key: string | null, delta: number): void {
  if (key === null) return
  map.set(key, (map.get(key) ?? 0) + delta)
}

/** Cumule les signaux de l'historique. `pass` ne pèse rien. */
export function affinityFromHistory(
  history: ReadonlyArray<Interaction>,
  seatsById: ReadonlyMap<string, EngineSeat>,
): Affinity {
  const material = new Map<string, number>()
  const seatKind = new Map<string, number>()
  const family = new Map<string, number>()
  for (const interaction of history) {
    const seat = seatsById.get(interaction.productId)
    if (!seat) continue
    const delta = interaction.action === 'like' ? 1 : interaction.action === 'dislike' ? -1 : 0
    if (delta === 0) continue
    bump(material, seat.material, delta)
    bump(seatKind, seat.seatKind, delta)
    bump(family, seat.familyId, delta)
  }
  return { material, seatKind, family }
}

/** Affinité pure d'un candidat (sans diversité). */
export function affinityScore(candidate: EngineSeat, affinity: Affinity): number {
  let score = 0
  if (candidate.material) score += affinity.material.get(candidate.material) ?? 0
  if (candidate.seatKind) score += affinity.seatKind.get(candidate.seatKind) ?? 0
  if (candidate.familyId) score += affinity.family.get(candidate.familyId) ?? 0
  return score
}

/** Score complet de découverte = affinité + nouveauté + répétition. */
export function scoreCandidate(
  candidate: EngineSeat,
  affinity: Affinity,
  shown: ReadonlyArray<EngineSeat>,
): number {
  return (
    affinityScore(candidate, affinity) +
    noveltyBonus(candidate, shown) +
    repetitionPenalty(candidate, shown)
  )
}

export const MAX_FINALISTS = 3

export interface FinalistSelection {
  /** Identifiants retenus, au plus MAX_FINALISTS, dans l'ordre de score. */
  readonly finalistIds: ReadonlyArray<string>
  /** Favoris restants, classés, proposables par « Voir plus ». */
  readonly remainingIds: ReadonlyArray<string>
}

/**
 * Sélection des finalistes parmi les FAVORIS (j'aime) uniquement :
 * - classés par affinité décroissante, puis par ancienneté du j'aime ;
 * - les deux premiers sont retenus s'ils existent ;
 * - un troisième n'est retenu que si son affinité est strictement positive :
 *   on ne remplit jamais l'interface avec un finaliste inventé.
 */
export function selectFinalists(
  favoriteIds: ReadonlyArray<string>,
  affinity: Affinity,
  seatsById: ReadonlyMap<string, EngineSeat>,
): FinalistSelection {
  const ranked = favoriteIds
    .map((id, index) => ({ id, index, seat: seatsById.get(id) }))
    .filter((entry): entry is { id: string; index: number; seat: EngineSeat } => Boolean(entry.seat))
    .map((entry) => ({ ...entry, score: affinityScore(entry.seat, affinity) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const finalists: string[] = []
  for (const entry of ranked) {
    if (finalists.length >= MAX_FINALISTS) break
    if (finalists.length === MAX_FINALISTS - 1 && entry.score <= 0) break
    finalists.push(entry.id)
  }
  const remaining = ranked.map((entry) => entry.id).filter((id) => !finalists.includes(id))
  return { finalistIds: finalists, remainingIds: remaining }
}

/** « Voir plus de finalistes » : deux candidats supplémentaires à comparer,
 *  jamais ajoutés d'office (la sélection reste ≤ MAX_FINALISTS). */
export function moreFinalistCandidates(
  selection: FinalistSelection,
  alreadyShown: ReadonlyArray<string>,
  count = 2,
): ReadonlyArray<string> {
  return selection.remainingIds.filter((id) => !alreadyShown.includes(id)).slice(0, count)
}

/** Décision pour « Voir plus » : consulter reste possible sans remplir la
 * troisième place. Un remplacement à sélection pleine reste explicite. */
export function finalistCandidateAction(
  candidateId: string,
  finalistIds: ReadonlyArray<string>,
  affinity: Affinity,
  seatsById: ReadonlyMap<string, EngineSeat>,
): 'add' | 'replace' | 'compare' {
  const candidate = seatsById.get(candidateId)
  if (!candidate || finalistIds.includes(candidateId)) return 'compare'
  if (finalistIds.length >= MAX_FINALISTS) return 'replace'
  if (finalistIds.length === MAX_FINALISTS - 1 && !(affinityScore(candidate, affinity) > 0)) return 'compare'
  return 'add'
}
