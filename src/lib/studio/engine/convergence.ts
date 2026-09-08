import type { VisualNeighbor } from '../visual'
import type { EngineCatalogue, EngineState } from './types'
import { rankVisualSeats, V1_POLICY } from './v1'

export interface ConvergenceResult {
  readonly state: 'insufficient_signal' | 'ready' | 'stalled'
  readonly reasons: ReadonlyArray<string>
  readonly metrics: {
    informative: number
    likes: number
    stability: number
    separation: number
    coherence: number
    remainingNovelty: number
    clusters: number
  }
}
/** Recalcul intégral à partir de l'historique : Undo exact, aucun cache caché. */
export function evaluateConvergence(
  state: EngineState,
  catalogue: EngineCatalogue,
  neighbors: ReadonlyArray<VisualNeighbor>,
): ConvergenceResult {
  const ranking = rankVisualSeats(state, catalogue, neighbors)
  const ids = new Set(catalogue.seats.map((s) => s.id))
  const history = state.history.filter((h) => ids.has(h.productId))
  const latest = [...new Map(history.map((h) => [h.productId, h])).values()]
  const informative = latest.filter((h) => h.action !== 'pass').length
  const likes = latest.filter((h) => h.action === 'like').length
  const ordered = [...ranking.ranked].sort(
    (a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id),
  )
  const top = ordered.slice(0, V1_POLICY.recommendationCount)
  const mean = (values: ReadonlyArray<number>) =>
    values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0
  const separation =
    mean(top.map((s) => s.affinity)) -
    mean(ordered.slice(V1_POLICY.recommendationCount).map((s) => s.affinity))
  const previous: number[] = []
  for (
    let offset = 1;
    offset <= V1_POLICY.stabilityWindow && history.length >= offset;
    offset++
  ) {
    const before = rankVisualSeats(
      { ...state, history: history.slice(0, -offset) },
      catalogue,
      neighbors,
    )
    const best = [...before.ranked]
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, V1_POLICY.recommendationCount)
    previous.push(
      top.filter((s) => best.some((b) => b.id === s.id)).length /
        Math.max(1, top.length),
    )
  }
  const stability =
    previous.length === V1_POLICY.stabilityWindow ? Math.min(...previous) : 0
  const stableClusters = ranking.clusters.filter(
    (c) => c.length >= V1_POLICY.minimumClusterLikes,
  )
  const coherence = mean(
    stableClusters.map((cluster) =>
      mean(
        cluster.flatMap((a, i) =>
          cluster.slice(i + 1).map((b) => ranking.similarity(a, b)),
        ),
      ),
    ),
  )
  const shown = new Set(history.map((h) => h.productId))
  const informativeIds = history
    .filter((h) => h.action !== 'pass')
    .map((h) => h.productId)
  const upcoming = ranking.ranked
    .filter((s) => !shown.has(s.id))
    .slice(0, V1_POLICY.informationWindow)
  const remainingNovelty = mean(
    upcoming.map(
      (s) =>
        1 -
        Math.max(
          0,
          ...informativeIds.map((id) => ranking.similarity(s.id, id)),
        ),
    ),
  )
  const metrics = {
    informative,
    likes,
    stability,
    separation,
    coherence,
    remainingNovelty,
    clusters: stableClusters.length,
  }
  const reasons: string[] = []
  if (
    informative < V1_POLICY.minimumInformative ||
    likes < V1_POLICY.minimumLikes
  )
    reasons.push('insufficient_informative_signal')
  if (ranking.coverage < V1_POLICY.minimumCoverage)
    reasons.push('insufficient_visual_coverage')
  if (stability < V1_POLICY.minimumStability) reasons.push('unstable_ranking')
  if (separation < V1_POLICY.minimumSeparation) reasons.push('weak_separation')
  if (coherence < V1_POLICY.minimumCoherence || stableClusters.length === 0)
    reasons.push('unclear_directions')
  if (remainingNovelty > V1_POLICY.maximumRemainingNovelty)
    reasons.push('information_remaining')
  if (!reasons.length)
    return {
      state: 'ready',
      reasons: ['stable_separated_directions', 'low_remaining_information'],
      metrics,
    }
  const sparse =
    informative / Math.max(1, history.length) < V1_POLICY.sparseSignalRate
  const stalled =
    history.length >= V1_POLICY.stalledObservationFloor &&
    (sparse ||
      ranking.coverage < V1_POLICY.minimumCoverage ||
      (history.length >= V1_POLICY.stalledAmbiguousFloor &&
        (coherence < V1_POLICY.minimumCoherence ||
          separation < V1_POLICY.minimumSeparation)))
  return {
    state: stalled ? 'stalled' : 'insufficient_signal',
    reasons,
    metrics,
  }
}
