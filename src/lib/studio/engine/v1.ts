// V1 : uniquement proximité visuelle précalculée. Aucun embedding ou modèle ML.
// Les faits commerciaux ne sont pas des signaux. V0 reste le repli explicite.
import type { VisualNeighbor } from '../visual'
import { createSeededRandom, hashSeed } from './seed'
import type { EngineCatalogue, EngineState, Interaction } from './types'
import { nextCard as nextCardV0, type NextCard } from './v0'
import { V1_MODEL_VERSION } from './versions'

export const V1_VERSION = 'v1.0' as const
export const V1_POLICY = Object.freeze({
  version: V1_VERSION,
  modelVersion: V1_MODEL_VERSION,
  minimumCoverage: 0.5,
  similarityThreshold: 0.55,
  clusterSimilarity: 0.78,
  maximumClusters: 3,
  recommendationCount: 3,
  minimumClusterLikes: 2,
  repetitionWindow: 5,
  informationWindow: 5,
  promptQuietObservations: 4,
  exploration: 0.2,
  rejectionWeight: 1.1,
  repetitionWeight: 0.35,
  minimumInformative: 4,
  minimumLikes: 2,
  stabilityWindow: 3,
  minimumStability: 2 / 3,
  minimumSeparation: 0.08,
  minimumCoherence: 0.7,
  maximumRemainingNovelty: 0.55,
  stalledObservationFloor: 14,
  stalledAmbiguousFloor: 20,
  sparseSignalRate: 0.25,
})
export type Similarity = (a: string, b: string) => number
export function visualSimilarity(
  ids: ReadonlyArray<string>,
  neighbors: ReadonlyArray<VisualNeighbor>,
): Similarity {
  const allowed = new Set(ids)
  const graph = new Map<string, Map<string, number>>()
  for (const edge of neighbors) {
    if (
      edge.model_version !== V1_POLICY.modelVersion ||
      !allowed.has(edge.product_id) ||
      !allowed.has(edge.neighbor_product_id) ||
      !Number.isFinite(edge.similarity) ||
      edge.similarity < 0 ||
      edge.similarity > 1
    )
      continue
    const list = graph.get(edge.product_id) ?? new Map<string, number>()
    list.set(edge.neighbor_product_id, edge.similarity)
    graph.set(edge.product_id, list)
  }
  return (a, b) =>
    a === b && allowed.has(a)
      ? 1
      : Math.max(graph.get(a)?.get(b) ?? 0, graph.get(b)?.get(a) ?? 0)
}

function signals(
  history: ReadonlyArray<Interaction>,
  ids: ReadonlyArray<string>,
) {
  const allowed = new Set(ids)
  // Dernière décision par produit ; pass ne produit pas de signal négatif.
  const latest = new Map<string, Interaction['action']>()
  for (const h of history)
    if (allowed.has(h.productId)) latest.set(h.productId, h.action)
  return {
    likes: [...latest]
      .filter(([, action]) => action === 'like')
      .map(([id]) => id),
    dislikes: [...latest]
      .filter(([, action]) => action === 'dislike')
      .map(([id]) => id),
  }
}
export function preferenceClusters(
  likes: ReadonlyArray<string>,
  similarity: Similarity,
): ReadonlyArray<ReadonlyArray<string>> {
  const clusters: string[][] = []
  for (const id of likes) {
    const ranked = clusters
      .map((members, index) => ({
        index,
        score:
          members.reduce((sum, other) => sum + similarity(id, other), 0) /
          members.length,
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
    const best = ranked[0]
    if (best && best.score >= V1_POLICY.clusterSimilarity)
      clusters[best.index]!.push(id)
    else if (clusters.length < V1_POLICY.maximumClusters) clusters.push([id])
    // Les signaux supplémentaires isolés ne créent pas une fausse direction.
  }
  return clusters
}
const evidence = (similarity: number) =>
  Math.max(
    0,
    (similarity - V1_POLICY.similarityThreshold) /
      (1 - V1_POLICY.similarityThreshold),
  )
export interface VisualRanking {
  readonly ranked: ReadonlyArray<{
    id: string
    affinity: number
    score: number
    direction: number
  }>
  readonly clusters: ReadonlyArray<ReadonlyArray<string>>
  readonly coverage: number
  readonly similarity: Similarity
}
export function rankVisualSeats(
  state: EngineState,
  catalogue: EngineCatalogue,
  neighbors: ReadonlyArray<VisualNeighbor>,
): VisualRanking {
  const ids = catalogue.seats.map((s) => s.id)
  const allowed = new Set(ids)
  const similarity = visualSimilarity(ids, neighbors)
  const { likes, dislikes } = signals(state.history, ids)
  const clusters = preferenceClusters(likes, similarity)
  const covered = new Set(
    neighbors
      .filter(
        (e) =>
          e.model_version === V1_POLICY.modelVersion &&
          e.product_id !== e.neighbor_product_id &&
          Number.isFinite(e.similarity) &&
          e.similarity >= 0 &&
          e.similarity <= 1 &&
          allowed.has(e.product_id) &&
          allowed.has(e.neighbor_product_id),
      )
      .flatMap((e) => [e.product_id, e.neighbor_product_id]),
  )
  const shown = state.history
    .slice(-V1_POLICY.repetitionWindow)
    .map((h) => h.productId)
  const ranked = ids
    .map((id) => {
      const directions = clusters
        .map((members, direction) => ({
          direction,
          score:
            members.reduce(
              (sum, other) => sum + evidence(similarity(id, other)),
              0,
            ) / members.length,
        }))
        .sort((a, b) => b.score - a.score || a.direction - b.direction)
      const negative = Math.max(
        0,
        ...dislikes.map((other) => evidence(similarity(id, other))),
      )
      const affinity =
        (directions[0]?.score ?? 0) - negative * V1_POLICY.rejectionWeight
      const repetition = Math.max(
        0,
        ...shown.map((other) => evidence(similarity(id, other))),
      )
      return {
        id,
        affinity,
        direction: directions[0]?.direction ?? 0,
        score: affinity - V1_POLICY.repetitionWeight * repetition,
      }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return {
    ranked,
    clusters,
    coverage: ids.length ? covered.size / ids.length : 0,
    similarity,
  }
}

export function nextCardV1(
  state: EngineState,
  catalogue: EngineCatalogue,
  neighbors: ReadonlyArray<VisualNeighbor>,
): NextCard | null {
  const ranking = rankVisualSeats(state, catalogue, neighbors)
  const fallback = () => nextCardV0(state, catalogue, V1_VERSION)
  if (
    ranking.coverage < V1_POLICY.minimumCoverage ||
    !state.history.some((h) => h.action !== 'pass')
  )
    return fallback()
  const shown = new Set(state.history.map((h) => h.productId))
  const remaining = ranking.ranked.filter((s) => !shown.has(s.id))
  if (!remaining.length) return null
  const random = createSeededRandom(
    hashSeed(`${state.sessionId}:${V1_VERSION}:${state.history.length}`),
  )
  if (random() < V1_POLICY.exploration) {
    // Exploration parmi TOUS les restants, y compris sans voisins.
    const candidates = [...remaining].sort((a, b) => a.id.localeCompare(b.id))
    return {
      productId: candidates[Math.floor(random() * candidates.length)]!.id,
      position: state.history.length,
      reason: 'exploration',
      algorithmVersion: V1_VERSION,
    }
  }
  const direction = state.history.length % Math.max(1, ranking.clusters.length)
  const candidate =
    remaining.find((s) => s.direction === direction && s.affinity > 0) ??
    remaining[0]!
  return {
    productId: candidate.id,
    position: state.history.length,
    reason: 'score',
    algorithmVersion: V1_VERSION,
  }
}

export function selectVisualFinalists(
  favorites: ReadonlyArray<string>,
  ranking: VisualRanking,
) {
  const allowed = new Set(favorites)
  const ranked = ranking.ranked
    .filter((s) => allowed.has(s.id))
    .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
  const finalistIds: string[] = []
  // Représente les directions aimées avant de compléter la sélection.
  for (let direction = 0; direction < ranking.clusters.length; direction++) {
    const candidate = ranked.find(
      (s) => s.direction === direction && s.affinity > 0,
    )
    if (candidate && finalistIds.length < V1_POLICY.recommendationCount)
      finalistIds.push(candidate.id)
  }
  for (const candidate of ranked) {
    if (finalistIds.length >= V1_POLICY.recommendationCount) break
    if (finalistIds.includes(candidate.id)) continue
    if (finalistIds.length === 2 && candidate.affinity <= 0) continue
    finalistIds.push(candidate.id)
  }
  return {
    finalistIds,
    remainingIds: ranked
      .map((s) => s.id)
      .filter((id) => !finalistIds.includes(id)),
  }
}
