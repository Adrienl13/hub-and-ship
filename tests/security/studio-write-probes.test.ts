import { expect, it } from 'vitest'
import {
  studioWriteDenied,
  studioWriteProbe,
  // @ts-expect-error Standalone JavaScript CLI helper.
} from '../../scripts/security/studio-write-probes.mjs'
it('seul un refus SQL de permission prouve le blocage, jamais une validation 400', () => {
  for (const [status, code] of [
    [400, '23502'],
    [400, '23503'],
    [400, '22P02'],
    [401, 'PGRST301'],
    [403, undefined],
    [201, '42501'],
  ])
    expect(studioWriteDenied(status, { code })).toBe(false)
  expect(studioWriteDenied(403, { code: '42501' })).toBe(true)
  expect(studioWriteDenied(401, { code: '42501' })).toBe(true)
})
it('payloads concrets ou limites relationnelles explicites', () => {
  for (const table of [
    'studio_table_base_types',
    'studio_model_families',
    'studio_sessions',
    'studio_curation_sets',
    'studio_algorithm_versions',
    'studio_product_profiles',
    'studio_fulfillment_options',
    'studio_product_media',
    'studio_visual_jobs',
    'studio_diagnostic_pairs',
    'studio_model_family_candidates',
  ]) {
    expect(
      Object.keys(studioWriteProbe(table, ['a', 'b'], '123456789').payload)
        .length,
    ).toBeGreaterThan(1)
  }
  for (const table of [
    'studio_table_base_profiles',
    'studio_tabletop_base_rules',
    'studio_events',
    'studio_product_visual_features',
    'studio_product_neighbors',
  ])
    expect(studioWriteProbe(table, ['a', 'b'], '123').limitation).toMatch(
      /PostgreSQL local/,
    )
  expect(
    studioWriteProbe('studio_diagnostic_pairs', ['a'], '123').limitation,
  ).toMatch(/Deux produits/)
})
