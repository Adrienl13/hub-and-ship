import type { StudioVisualData } from '../visual'
import type { EngineCatalogue } from './types'
import { rankVisualSeats, V1_POLICY } from './v1'
import { V1_MODEL_VERSION, type StudioAlgorithmVersion } from './versions'

/** Assignment is immutable attribution; operational readiness gates EVERY
 * V1 behavior (cards, finalists, convergence and diagnostic comparisons). */
export function resolveStudioEngine(
  assigned: StudioAlgorithmVersion | null,
  access: string,
  catalogue: EngineCatalogue | null,
  visual: StudioVisualData,
) {
  const v1Assigned = assigned === 'v1.0'
  const published = visual.versions.some(
    (v) =>
      v.version === 'v1.0' &&
      v.engine === 'v1' &&
      v.model_version === V1_MODEL_VERSION &&
      (v.status === 'preview' || v.status === 'active'),
  )
  const coverage = catalogue
    ? rankVisualSeats(
        { sessionId: 'coverage', history: [] },
        catalogue,
        visual.neighbors,
      ).coverage
    : 0
  const v1Operational =
    v1Assigned &&
    access === 'preview' &&
    published &&
    coverage >= V1_POLICY.minimumCoverage
  return {
    v1Assigned,
    v1Operational,
    coverage,
    effectiveEngine: v1Operational ? ('v1' as const) : ('v0' as const),
  }
}
