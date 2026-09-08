import { hashSeed } from './seed'
export const ALGORITHM_VERSIONS = ['v0.1', 'v1.0'] as const
export type StudioAlgorithmVersion = (typeof ALGORITHM_VERSIONS)[number]
export const V1_MODEL_VERSION =
  'dinov2-small:ed25f3a31f01632728cabb09d1542f84ab7b0056:cls-l2-v1'

/** Attribution uniquement à la création. Public : V0, jamais d'A/B implicite. */
export function assignStudioAlgorithm(
  sessionId: string,
  access: string,
  requested?: string,
): StudioAlgorithmVersion {
  if (access !== 'preview') return 'v0.1'
  if (requested === 'v1') return 'v1.0'
  if (requested === 'compare')
    return hashSeed(`${sessionId}:preview-v1`) % 2 ? 'v1.0' : 'v0.1'
  return 'v0.1'
}
