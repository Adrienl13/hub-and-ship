import { expect, it } from 'vitest'
import { resolveStudioEngine } from './runtime'
import { V1_MODEL_VERSION } from './versions'
import type { EngineCatalogue } from './types'
import type { StudioVisualData } from '../visual'
const catalogue: EngineCatalogue = {
  seats: Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    material: null,
    seatKind: null,
    familyId: null,
  })),
  diagnosticPairs: [],
}
const visual: StudioVisualData = {
  versions: [
    {
      version: 'v1.0',
      engine: 'v1',
      model_version: V1_MODEL_VERSION,
      status: 'preview',
    },
  ],
  neighbors: catalogue.seats.map((s, i) => ({
    product_id: s.id,
    neighbor_product_id: String((i + 1) % 10),
    rank: 1,
    similarity: 0.9,
    model_version: V1_MODEL_VERSION,
  })),
}
it('V1 opérationnel uniquement avec preview, version publiée, modèle et couverture', () => {
  expect(
    resolveStudioEngine('v1.0', 'preview', catalogue, visual),
  ).toMatchObject({
    v1Assigned: true,
    v1Operational: true,
    effectiveEngine: 'v1',
    coverage: 1,
  })
  for (const data of [
    { ...visual, neighbors: [] },
    { ...visual, neighbors: visual.neighbors.slice(0, 2) },
    { ...visual, versions: [] },
    { ...visual, versions: [{ ...visual.versions[0]!, status: 'disabled' }] },
    {
      ...visual,
      versions: [{ ...visual.versions[0]!, model_version: 'other' }],
    },
  ]) {
    expect(
      resolveStudioEngine('v1.0', 'preview', catalogue, data),
    ).toMatchObject({
      v1Assigned: true,
      v1Operational: false,
      effectiveEngine: 'v0',
    })
  }
  expect(
    resolveStudioEngine('v1.0', 'public', catalogue, visual).v1Operational,
  ).toBe(false)
  expect(
    resolveStudioEngine('v0.1', 'preview', catalogue, visual),
  ).toMatchObject({ v1Assigned: false, v1Operational: false })
  expect(
    resolveStudioEngine('v1.0', 'preview', null, visual).v1Operational,
  ).toBe(false)
})
