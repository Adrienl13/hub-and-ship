import { expect, test } from '@playwright/test'
import { V1_MODEL_VERSION } from '../../src/lib/studio/engine/versions'
const ids = Array.from(
  { length: 80 },
  (_, i) => `p${String(i).padStart(2, '0')}`,
)
const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const edges = ids.flatMap((a, i) =>
  ids.flatMap((b, j) =>
    i !== j && Math.floor(i / 10) === Math.floor(j / 10)
      ? [
          {
            product_id: a,
            neighbor_product_id: b,
            rank: (j % 10) + 1,
            similarity: 0.94,
            model_version: V1_MODEL_VERSION,
          },
        ]
      : [],
  ),
)
test('preview V1 : apprend, propose, continue, Undo, finalistes et persistance', async ({
  page,
  context,
}) => {
  await page.route('https://fake-supabase.test/rest/v1/**', (route) => {
    const url = new URL(route.request().url()),
      table = url.pathname.split('/').pop()
    let rows: unknown[] = []
    if (table === 'studio_products')
      rows = ids.map((id, i) => ({
        id,
        sku: id,
        name: `Assise ${id}`,
        category: 'chair',
        is_active: true,
        studio_role: 'seat',
        seat_kind: 'chair',
        material: 'rope',
        dim_length_cm: 50,
        dim_width_cm: 50,
        dim_height_cm: 80,
        weight_kg: 4,
        moq_units: 50,
        base_price_ht: 80,
        main_image_url: pixel,
        gallery_urls: [],
        sort_order: i,
        data_quality: {
          price: { status: 'verified', source: 'catalogue_public_price' },
        },
      }))
    if (table === 'product_variants')
      rows = ids.map((id) => ({
        id: `${id}-std`,
        product_id: id,
        name: 'Standard',
        image_url: pixel,
        sort_order: 0,
      }))
    if (table === 'studio_product_neighbors_public')
      rows = edges.slice(
        Number(url.searchParams.get('offset') ?? 0),
        Number(url.searchParams.get('offset') ?? 0) +
          Number(url.searchParams.get('limit') ?? 500),
      )
    if (table === 'studio_algorithm_versions_public')
      rows = [
        {
          version: 'v1.0',
          engine: 'v1',
          model_version: V1_MODEL_VERSION,
          status: 'preview',
        },
      ]
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    })
  })
  await page.route('https://fake-supabase.test/auth/v1/**', (r) =>
    r.fulfill({ status: 401, body: '{}' }),
  )
  const batches: { algorithmVersion: string }[] = []
  await page.route('**/api/studio/events', (r) => {
    batches.push(r.request().postDataJSON())
    return r.fulfill({ status: 202, body: '{}' })
  })
  await context.request.get(
    '/studio/preview?key=studio-preview-navigation-test-only',
  )
  await page.goto('/studio/assises?engine=v1')
  const card = page.getByTestId('decision-card')
  await expect(card).toBeVisible()
  let firstGroup: number | null = null,
    promptAt = 0
  for (let i = 0; i < 24; i++) {
    const heading = await card.locator('h2').innerText()
    const id = heading.match(/p(\d+)/)![1]!,
      group = Math.floor(Number(id) / 10)
    firstGroup ??= group
    await card
      .getByRole('button', {
        name: group === firstGroup ? /^J'aime :/ : /^Pas pour moi :/,
      })
      .click()
    if (await page.getByTestId('convergence-prompt').isVisible()) {
      promptAt = i + 1
      break
    }
  }
  expect(promptAt).toBeGreaterThan(0)
  expect(promptAt).toBeLessThan(24)
  const before = await card.locator('h2').innerText()
  await page
    .getByRole('button', { name: 'Continuer à explorer', exact: true })
    .click()
  await expect(page.getByTestId('convergence-prompt')).toBeHidden()
  await card.getByRole('button', { name: /^Passer :/ }).click()
  await expect(card.locator('h2')).not.toHaveText(before)
  await page
    .getByRole('button', { name: /Annuler/ })
    .first()
    .click()
  await expect(card.locator('h2')).toHaveText(before)
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('terrassea-studio-v1')!).state,
  )
  expect(saved.algorithmVersion).toBe('v1.0')
  await page.reload()
  await expect(card.locator('h2')).toHaveText(before)
  await expect(page.getByTestId('convergence-prompt')).toBeVisible()
  await page.getByRole('button', { name: 'Voir mes meilleures pistes' }).click()
  const finalists = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('terrassea-studio-v1')!).state.discovery
        .finalistIds,
  )
  expect(finalists.length).toBeGreaterThan(0)
  expect(finalists.length).toBeLessThanOrEqual(3)
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('terrassea-studio-v1')!).state
          .sessionId,
    ),
  ).toBe(saved.sessionId)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.waitForTimeout(1100)
  expect(batches.length).toBeGreaterThan(0)
  expect(batches.every((b) => b.algorithmVersion === 'v1.0')).toBe(true)
})
