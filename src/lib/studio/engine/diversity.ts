// Diversité (lot 2) : ordre initial en round-robin par matière puis par
// sous-type d'assise, bonus de nouveauté, malus de répétition. Tout est
// déterministe et sans prix.

import type { EngineSeat } from './types'
import { seededShuffle } from './seed'

const UNKNOWN = '__unknown__'

function groupBy<T>(items: ReadonlyArray<T>, key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const bucket = key(item)
    const list = groups.get(bucket) ?? []
    list.push(item)
    groups.set(bucket, list)
  }
  return groups
}

function roundRobin<T>(groups: ReadonlyArray<ReadonlyArray<T>>): T[] {
  const result: T[] = []
  const longest = groups.reduce((max, group) => Math.max(max, group.length), 0)
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const item = group[index]
      if (item !== undefined) result.push(item)
    }
  }
  return result
}

/**
 * Ordre initial : les matières alternent (round-robin), et à l'intérieur
 * d'une matière les sous-types alternent aussi. L'ordre des groupes et
 * l'ordre interne sont mélangés avec le générateur seedé fourni : deux
 * sessions voient des séquences différentes, une même session revoit
 * toujours la même.
 */
export function interleaveByDiversity(
  seats: ReadonlyArray<EngineSeat>,
  random: () => number,
): EngineSeat[] {
  const byMaterial = groupBy(seats, (seat) => seat.material ?? UNKNOWN)
  const materialGroups = seededShuffle([...byMaterial.values()], random).map((group) => {
    const byKind = groupBy(group, (seat) => seat.seatKind ?? UNKNOWN)
    const kindGroups = seededShuffle([...byKind.values()], random).map((kindGroup) =>
      seededShuffle(kindGroup, random),
    )
    return roundRobin(kindGroups)
  })
  return roundRobin(materialGroups)
}

/** Bonus de nouveauté : une matière ou un sous-type jamais montré vaut +0.5
 *  chacun. Encourage la couverture du catalogue avant de creuser. */
export function noveltyBonus(
  candidate: EngineSeat,
  shown: ReadonlyArray<EngineSeat>,
): number {
  let bonus = 0
  if (candidate.material && !shown.some((seat) => seat.material === candidate.material)) {
    bonus += 0.5
  }
  if (candidate.seatKind && !shown.some((seat) => seat.seatKind === candidate.seatKind)) {
    bonus += 0.5
  }
  return bonus
}

/** Malus de répétition : si les 3 dernières cartes montrées partagent toutes
 *  la matière (ou la famille vérifiée) du candidat, −1. */
export function repetitionPenalty(
  candidate: EngineSeat,
  shown: ReadonlyArray<EngineSeat>,
  window = 3,
): number {
  if (shown.length < window) return 0
  const last = shown.slice(-window)
  const sameMaterial =
    candidate.material !== null && last.every((seat) => seat.material === candidate.material)
  const sameFamily =
    candidate.familyId !== null && last.every((seat) => seat.familyId === candidate.familyId)
  return sameMaterial || sameFamily ? -1 : 0
}
