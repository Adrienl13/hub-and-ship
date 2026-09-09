import { mkdir } from 'node:fs/promises'
import { expect, test, type Page, type BrowserContext } from '@playwright/test'
import {
  nextCard,
  selectFinalists,
  affinityFromHistory,
  type Interaction,
} from '../../src/lib/studio/engine'
import { V1_MODEL_VERSION } from '../../src/lib/studio/engine/versions'
const ids = Array.from(
  { length: 80 },
  (_, i) => `p${String(i).padStart(2, '0')}`,
)
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
async function prepare(
  page: Page,
  context: BrowserContext,
  coverage = 'full',
  gate?: Promise<void>,
) {
  await page.route('https://fake-supabase.test/rest/v1/**', async (route) => {
    const url = new URL(route.request().url()),
      table = url.pathname.split('/').pop()
    if (table === 'studio_products') {
      await gate
      if (coverage === 'error')
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: '{"message":"fixture unavailable"}',
        })
    }
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
        main_image_url: '/catalogue/bistro-seating-clean/BIS-002-01.webp',
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
        image_url: '/catalogue/bistro-seating-clean/BIS-002-01.webp',
        sort_order: 0,
      }))
    if (table === 'studio_product_neighbors_public')
      rows = (
        coverage === 'empty'
          ? []
          : coverage === 'partial'
            ? edges.filter((e) => Number(e.product_id.slice(1)) < 10)
            : edges
      ).slice(
        Number(url.searchParams.get('offset') ?? 0),
        Number(url.searchParams.get('offset') ?? 0) +
          Number(url.searchParams.get('limit') ?? 500),
      )
    if (table === 'studio_diagnostic_pairs_public')
      rows = ids.flatMap((a, i) =>
        ids.slice(i + 1).map((b) => ({
          id: `${a}-${b}`,
          product_a_id: a,
          product_b_id: b,
          axis: 'openness',
        })),
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
}

test('inspection visuelle guidée du projet', async ({
  page,
  context,
}, testInfo) => {
  await prepare(page, context)
  await expect(page.locator('[data-studio-engine=v1]')).toBeVisible()
  const card = page.getByTestId('decision-card')
  await expect(card).toBeVisible()

  const folder = process.env.STUDIO_CAPTURE_DIR ?? '.cache/studio-review/after'
  await mkdir(folder, { recursive: true })
  const capture = async (name: string) => {
    if (name !== 'details') await page.evaluate(() => window.scrollTo(0, 0))
    await page.evaluate(async () => {
      const visible = Array.from(document.images).filter(image => {
        const rect = image.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
      })
      await Promise.all(visible.map(image => image.decode().catch(() => {})))
    })
    await page.screenshot({
      path: `${folder}/${testInfo.project.name}-${name}.png`,
      fullPage: false,
      animations: 'disabled',
    })
  }
  await capture('discovery')
  let firstGroup: number | null = null
  for (let i = 0; i < 24; i++) {
    const text = await card.locator('h2').innerText()
    const group = Math.floor(Number(text.match(/p(\d+)/)![1]) / 10)
    firstGroup ??= group
    await card
      .getByRole('button', {
        name: group === firstGroup ? /^J'aime :/ : /^Pas pour moi :/,
      })
      .click()
    if (await page.getByTestId('convergence-prompt').isVisible()) break
  }
  await expect(page.getByTestId('convergence-prompt')).toBeVisible()
  await page.getByTestId('convergence-prompt').scrollIntoViewIfNeeded()
  await capture('convergence')
  await page
    .getByRole('button', { name: 'Voir mes meilleures pistes', exact: true })
    .click()
  await expect(page.getByTestId('finalists')).toBeVisible()
  await page.getByTestId('finalists').scrollIntoViewIfNeeded()
  await capture('finalists')
  await page
    .getByTestId('finalists')
    .getByRole('button', { name: 'Détails', exact: true })
    .first()
    .click()
  await capture('details')
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Choisir cette assise', exact: true })
    .first()
    .click()
  await expect(page.getByTestId('quantity-stage')).toBeVisible()
  await expect(page.getByTestId('quantity-stage').getByRole('img')).toBeVisible()
  await expect.poll(() => page.getByTestId('quantity-stage').getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await capture('quantity')
})

for (const coverage of ['empty', 'partial'])
  test(`V1 assigné, couverture ${coverage} : tout le parcours reste V0`, async ({
    page,
    context,
  }) => {
    await prepare(page, context, coverage)
    await expect(
      page.locator('[data-studio-engine=v0][data-v1-assigned=true]'),
    ).toBeVisible()
    const catalogue = {
      seats: ids.map((id) => ({
        id,
        material: 'rope' as const,
        seatKind: 'chair' as const,
        familyId: null,
      })),
      diagnosticPairs: [],
    }
    const card = page.getByTestId('decision-card')
    const history: Interaction[] = []
    const saved = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('terrassea-studio-v1')!).state,
      )
    const sessionId = (await saved()).sessionId
    for (let i = 0; i < 16; i++) {
      const expected = nextCard({ sessionId, history }, catalogue)!
      await expect(card.locator('h2')).toHaveText(
        `Assise ${expected.productId}`,
      )
      await expect(card).not.toHaveAttribute('aria-label', /sur \d+/)
      const action = i < 4 ? 'like' : 'pass'
      await card
        .getByRole('button', {
          name: action === 'like' ? /^J'aime :/ : /^Passer :/,
        })
        .click()
      history.push({ productId: expected.productId, action })
      await expect(page.getByTestId('convergence-prompt')).toHaveCount(0)
    }
    await page
      .getByRole('button', { name: 'Vos finalistes', exact: true })
      .click()
    const state = await saved()
    const seats = new Map(catalogue.seats.map((s) => [s.id, s]))
    expect(state.discovery.finalistIds).toEqual(
      selectFinalists(
        state.discovery.favoriteIds,
        affinityFromHistory(history, seats),
        seats,
      ).finalistIds,
    )
    expect(state.algorithmVersion).toBe('v1.0')
    await expect(
      page.getByRole('region', { name: 'Comparaison diagnostique' }),
    ).toHaveCount(0)
    await expect(
      page.getByText(
        'Vos favoris réunis pour comparer et choisir une assise pour votre projet.',
      ),
    ).toBeVisible()
  })

test('états chargement, erreur, réessai et sélection indisponible', async ({
  page,
  context,
}, info) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await prepare(page, context, 'error', gate)
  const folder = process.env.STUDIO_CAPTURE_DIR ?? '.cache/studio-review/after'
  await mkdir(folder, { recursive: true })
  await expect(page.getByLabel('Chargement des assises')).toBeVisible()
  await page.screenshot({
    path: `${folder}/${info.project.name}-loading.png`,
    animations: 'disabled',
  })
  release()
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  await page.screenshot({
    path: `${folder}/${info.project.name}-error.png`,
    animations: 'disabled',
  })
  await page.route(
    (url) => url.pathname.endsWith('/studio_products'),
    (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(
    page.getByText(
      "Aucune assise n'est disponible pour la découverte pour le moment.",
      { exact: true },
    ),
  ).toBeVisible()
  await page.screenshot({
    path: `${folder}/${info.project.name}-empty.png`,
    animations: 'disabled',
  })
})

test('fin des pistes sans injonction à terminer le catalogue', async ({
  page,
  context,
}, info) => {
  await prepare(page, context, 'empty')
  await expect(page.getByTestId('decision-card')).toBeVisible()
  await page.evaluate((ids) => {
    const saved = JSON.parse(localStorage.getItem('terrassea-studio-v1')!)
    saved.state.discovery.interactions = ids.map((productId) => ({
      productId,
      action: 'pass',
      at: new Date().toISOString(),
    }))
    localStorage.setItem('terrassea-studio-v1', JSON.stringify(saved))
  }, ids)
  await page.reload()
  await expect(page.getByTestId('discovery-exhausted')).toBeVisible()
  await expect(
    page.getByText('Faisons le point sur votre projet.'),
  ).toBeVisible()
  const folder = process.env.STUDIO_CAPTURE_DIR ?? '.cache/studio-review/after'
  await mkdir(folder, { recursive: true })
  await page.screenshot({
    path: `${folder}/${info.project.name}-exhausted.png`,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Revoir les assises' }).click()
  await expect(page.getByTestId('decision-card')).toBeVisible()
})
