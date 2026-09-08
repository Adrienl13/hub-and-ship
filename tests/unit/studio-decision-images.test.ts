// @vitest-environment node
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  analyzePackshot,
  decisionPlacement,
} from '../../src/lib/images/packshot-metrics.mjs'
// CLI shares geometry/metrics with the existing browser normalizer.
// @ts-expect-error JavaScript CLI adapter has no declaration file
import { normalizeDecisionBuffer } from '../../scripts/normalize-packshots.mjs'
const fixture = () =>
  sharp({
    create: { width: 500, height: 700, channels: 3, background: 'white' },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="500" height="700"><path d="M150 150H350V400H320V600H290V430H210V600H180V400H150Z" fill="#a03629"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer()
it('Decision image : dimensions, cadre blanc, proportions et parties conservées', async () => {
  const source = await fixture(),
    digest = createHash('sha256').update(source).digest('hex')
  const result = await normalizeDecisionBuffer(source)
  for (const [index, size] of [1200, 600].entries()) {
    const image = result.images[index],
      meta = await sharp(image).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([size, size, 'webp'])
    const { data, info } = await sharp(image)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const analysis = analyzePackshot(data, size, size, info.channels)!
    expect(analysis.background).toBe(1)
    expect(analysis.box.w / analysis.box.h).toBeCloseTo(200 / 450, 1)
    expect(
      Math.abs(analysis.box.x + analysis.box.w / 2 - size / 2),
    ).toBeLessThan(3)
    // Every foot and the central opening survive: red feet, white gap.
    const rgb = (x: number, y: number) => [
      ...data.subarray((y * size + x) * 3, (y * size + x) * 3 + 3),
    ]
    expect(
      rgb(Math.round(size * 0.5), Math.round(size * 0.8)).every((v) => v > 240),
    ).toBe(true)
    expect(
      rgb(Math.round(size * 0.37), Math.round(size * 0.8))[0],
    ).toBeGreaterThan(
      rgb(Math.round(size * 0.37), Math.round(size * 0.8))[1]! + 40,
    )
  }
  expect(createHash('sha256').update(source).digest('hex')).toBe(digest)
  expect(result.analysis.quality_score).toBeGreaterThan(0)
  expect(result.analysis.quality_score).toBeLessThanOrEqual(1)
})
it('idempotent pour une source identique, traits déterministes et bornés', async () => {
  const source = await fixture(),
    a = await normalizeDecisionBuffer(source),
    b = await normalizeDecisionBuffer(source)
  expect(a.images[0].equals(b.images[0])).toBe(true)
  expect(a.traits).toEqual(b.traits)
  for (const key of [
    'edge_density',
    'global_contrast',
    'openness',
    'pattern_score',
  ])
    expect(a.traits[key]).toBeGreaterThanOrEqual(0)
  expect(a.pipeline_version).toBe('decision-v1')
})
it('refuse ambiance non neutre et ne prévoit aucun écrasement catalogue', async () => {
  const source = await sharp({
    create: { width: 500, height: 500, channels: 3, background: '#668899' },
  })
    .png()
    .toBuffer()
  await expect(normalizeDecisionBuffer(source)).rejects.toThrow(/Fond/)
  const code = readFileSync('scripts/normalize-packshots.mjs', 'utf8')
    .split('async function decisionBatch')[1]!
    .split('async function main')[0]!
  expect(code).not.toMatch(/main_image_url|\.from\(|normalizeFile/)
  expect(code).toContain("status: 'pending'")
  expect(code).toContain("provenance: 'pipeline'")
  expect(code).toContain('computed_at')
})
it('placement conserve le rapport largeur/hauteur avec une marge constante', () => {
  const p = decisionPlacement({ x: 0, y: 0, w: 200, h: 400 }, 1200)
  expect(p.width / p.height).toBe(0.5)
  expect(p.top).toBe(84)
})
