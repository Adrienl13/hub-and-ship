import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
// All commercial data below are test fixtures. Local catalogue photographs
// exercise real image rendering; missing tabletop image exercises the fallback.
const products = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `seat-${i}`,
    name: `Assise test ${i + 1}`,
    category: 'chair',
    studio_role: 'seat',
    table_shape: null,
    dim_length_cm: 48,
    dim_width_cm: 56,
    main_image_url: `/catalogue/bistro-seating-clean/BIS-019-01.webp`,
  })),
  {
    id: 'top',
    name: 'Plateau test 70',
    category: 'table_top',
    studio_role: 'tabletop',
    table_shape: 'rectangular',
    dim_length_cm: 70,
    dim_width_cm: 70,
    main_image_url: null,
  },
  {
    id: 'top-large',
    name: 'Plateau test 120',
    category: 'table_top',
    studio_role: 'tabletop',
    table_shape: 'rectangular',
    dim_length_cm: 120,
    dim_width_cm: 80,
    main_image_url: null,
  },
  {
    id: 'base',
    name: 'Piètement test validé',
    category: 'table_base',
    studio_role: 'base',
    table_shape: null,
    dim_length_cm: 45,
    dim_width_cm: 45,
    main_image_url: '/catalogue/table-base-series/TBA-001-01.webp',
  },
  {
    id: 'unknown',
    name: 'Piètement non confirmé',
    category: 'table_base',
    studio_role: 'base',
    table_shape: null,
    dim_length_cm: 45,
    dim_width_cm: 45,
    main_image_url: '/catalogue/table-base-series/TBA-003-01.webp',
  },
].map((p, i) => ({
  ...p,
  sku: p.id,
  description: 'Fixture E2E',
  dim_height_cm: 75,
  cbm_per_unit: 0.08,
  weight_kg: 5,
  moq_units: 50,
  base_price_ht: 62,
  retail_price_ref: 99,
  eco_contribution: 0,
  gallery_urls: [],
  features: [],
  is_active: true,
  sort_order: i,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  compatible_top_shapes: [],
  visibility: 'public',
  seat_kind: p.studio_role === 'seat' ? 'chair' : null,
  material: p.studio_role === 'seat' ? 'pe_weave' : null,
  model_family_id: null,
  visual_traits: null,
  data_quality: {
    price: { status: 'verified', source: 'catalogue_public_price' },
  },
}))
async function backend(page: Page) {
  await page.route('https://fake-supabase.test/**', async (route) => {
    const table = new URL(route.request().url()).pathname.split('/').pop()
    let body: unknown = []
    if (table === 'studio_customization_capabilities_public')
      body = [
        {
          id: 'color',
          product_id: 'seat-0',
          scope: 'seat',
          kind: 'structure_color',
          status: 'verified',
          values: ['Bleu test'],
          allows_free_text: false,
          requires_review: false,
          min_quantity: null,
          max_quantity: null,
        },
        {
          id: 'rope',
          product_id: 'seat-0',
          scope: 'seat',
          kind: 'rope_color',
          status: 'on_request',
          values: ['Corde test'],
          allows_free_text: false,
          requires_review: true,
          min_quantity: null,
          max_quantity: null,
        },
        {
          id: 'unavailable',
          product_id: 'seat-0',
          scope: 'seat',
          kind: 'finish',
          status: 'unavailable',
          values: ['Impossible'],
          allows_free_text: false,
          requires_review: false,
          min_quantity: null,
          max_quantity: null,
        },
        {
          id: 'top-finish',
          product_id: 'top',
          scope: 'tabletop',
          kind: 'tabletop_finish',
          status: 'verified',
          values: ['Mat test'],
          allows_free_text: false,
          requires_review: false,
          min_quantity: null,
          max_quantity: null,
        },
      ]
    if (table === 'studio_visual_library_public')
      body = JSON.parse(
        readFileSync('public/studio/materials/library.json', 'utf8'),
      )
    if (table === 'studio_products') body = products
    if (table === 'product_variants')
      body = products.map((p) => ({
        id: `${p.id}-std`,
        product_id: p.id,
        name: p.category === 'table_top' ? 'Marbre test' : 'Standard',
        image_url: p.main_image_url,
        gallery_urls: [],
        sort_order: 0,
        min_order_units: null,
      }))
    if (table === 'studio_tabletop_base_rules_public')
      body = [
        {
          id: 'rule',
          base_id: 'base',
          tabletop_id: 'top',
          base_type_id: null,
          shape: null,
          min_length_cm: null,
          min_width_cm: null,
          max_length_cm: null,
          max_width_cm: null,
          verdict: 'allowed',
        },
        {
          id: 'denied',
          base_id: 'base',
          tabletop_id: 'top-large',
          base_type_id: null,
          shape: null,
          min_length_cm: null,
          min_width_cm: null,
          max_length_cm: null,
          max_width_cm: null,
          verdict: 'denied',
        },
      ]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  await page.route('**/api/studio/events', (route) =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: '{"ok":true}',
    }),
  )
  await page.route('**/api/contact', () => {
    throw Error('No real contact allowed')
  })
}

test('atelier visuel, confidentialité, palette et dossier', async ({
  page,
}, info) => {
  await backend(page)
  await page.addInitScript(() => {
    if (localStorage.getItem('terrassea-studio-v1')) return
    localStorage.setItem(
      'terrassea-studio-v1',
      JSON.stringify({
        version: 5,
        state: {
          sessionId: 'lot5',
          algorithmVersion: 'v0.1',
          journal: [],
          discovery: { interactions: [], favoriteIds: [], finalistIds: [] },
          project: {
            entry: 'full_project',
            updatedAt: null,
            items: [
              {
                productId: 'seat-0',
                variantId: 'seat-0-std',
                role: 'seat',
                requestedQuantity: 60,
              },
              {
                productId: 'seat-1',
                variantId: 'seat-1-std',
                role: 'seat',
                requestedQuantity: 60,
              },
            ],
            tables: [
              {
                id: 'table-test',
                top: { productId: 'top', variantId: 'top-std' },
                base: { productId: 'base', variantId: 'base-std' },
                quantity: 30,
                quantityEdited: true,
                custom: null,
                verificationRequested: false,
                baseInvalidated: false,
              },
            ],
          },
        },
      }),
    )
  })
  let sent: Record<string, unknown> | undefined
  await page.route('**/api/contact', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{"ok":true}',
    })
  })

  await page.goto('/studio/personnalisation')
  await expect(
    page.getByRole('region', { name: 'Atelier matières' }),
  ).toBeVisible()
  const zoom = page.getByRole('button', {
    name: 'Agrandir PI-TR-007',
    exact: true,
  })
  await zoom.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(zoom).toBeFocused()
  await page
    .getByRole('button', { name: 'Comparer PI-TR-007', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Comparer PI-TR-003', exact: true })
    .click()
  await page.getByRole('button', { name: 'Comparer les 2 détails' }).click()
  await expect(page.getByRole('dialog')).toContainText('Deux matières')
  const firstDetail = await page.getByAltText('Détail PI-TR-007').boundingBox()
  const secondDetail = await page.getByAltText('Détail PI-TR-003').boundingBox()
  expect(Math.abs(firstDetail!.y - secondDetail!.y)).toBeLessThan(2)
  expect(secondDetail!.x).toBeGreaterThan(firstDetail!.x)
  await page.screenshot({
    path: `/tmp/studio-lot51-${info.project.name}-compare.png`,
  })
  await page.keyboard.press('Escape')
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'PI-TR-007', exact: true }),
  })
  await card.getByRole('button', { name: 'Retenir ce détail' }).click()
  await page.getByLabel('Couleurs du tressage souhaitées').fill('Bleu / Ivoire')
  await page.getByRole('button', { name: 'Noter cette palette' }).click()
  await expect(page.getByLabel('Votre planche matière')).toContainText(
    'Bleu / Ivoire',
  )
  const furniture = page.getByLabel('Mobilier de la planche')
  await furniture.selectOption({ label: 'Assise test 2' })
  await card.getByRole('button', { name: 'Retenir ce détail' }).click()
  await expect(page.getByLabel('Couleurs du tressage souhaitées')).toHaveValue(
    '',
  )
  await page
    .getByLabel('Couleurs du tressage souhaitées')
    .fill('Rouge non enregistré')
  await furniture.selectOption({ label: 'Assise test 1' })
  await expect(page.getByLabel('Couleurs du tressage souhaitées')).toHaveValue(
    'Bleu / Ivoire',
  )
  await furniture.selectOption({ label: 'Assise test 2' })
  await expect(page.getByLabel('Couleurs du tressage souhaitées')).toHaveValue(
    '',
  )
  await furniture.selectOption({ label: 'Assise test 1' })
  await page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { name: 'PI-TR-003', exact: true }),
    })
    .getByRole('button', { name: 'Retenir ce détail' })
    .click()
  await expect(page.getByLabel('Couleurs du tressage souhaitées')).toHaveValue(
    '',
  )
  await card.getByRole('button', { name: 'Retenir ce détail' }).click()
  await expect(page.getByLabel('Couleurs du tressage souhaitées')).toHaveValue(
    '',
  )
  await page.getByLabel('Couleurs du tressage souhaitées').fill('Bleu / Ivoire')
  await page.getByRole('button', { name: 'Noter cette palette' }).click()
  await page.reload()
  await expect(page.getByLabel('Votre planche matière')).toContainText(
    'PI-TR-007',
  )
  await expect(page.getByLabel('Votre planche matière')).toContainText(
    'Bleu / Ivoire',
  )
  if (info.project.name === '1440' || info.project.name === '1280') {
    await expect(
      page.getByRole('img', { name: 'Assise test 1', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('img', { name: 'Assise test 1', exact: true })
      .evaluate((img: HTMLImageElement) => img.decode())
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: `/tmp/studio-lot51-${info.project.name}-viewport.png`,
  })
  await page.screenshot({
    path: `/tmp/studio-lot51-${info.project.name}-atelier.png`,
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0)
  for (const url of [
    '/data/private/studio-visual-library/manifest.json',
    '/data/private/studio-visual-library/source-pe.jpg',
  ]) {
    const response = await page.request.get(url)
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(await response.text()).not.toContain('S-PE001')
  }
  await page
    .getByRole('button', { name: 'Voir le résumé et envoyer', exact: true })
    .click()
  await expect(
    page.getByLabel('Personnalisation demandée').first(),
  ).toContainText('PI-TR-007')
  await expect(
    page.getByLabel('Personnalisation demandée').first(),
  ).toContainText('Bleu / Ivoire')
  await expect(
    page.getByLabel('Personnalisation demandée').first(),
  ).toContainText('À confirmer')
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Conserver le dossier de composition' })
    .click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^PI-C-[0-9A-F]{24}\.json$/)
  await download.saveAs(`/tmp/studio-lot51-${info.project.name}-dossier.json`)
  await page.getByLabel('Votre nom *', { exact: true }).fill('Atelier Test')
  await page
    .getByLabel('Email professionnel *', { exact: true })
    .fill('atelier@example.test')
  await page
    .getByRole('button', { name: 'Envoyer le message', exact: true })
    .click()
  await expect.poll(() => sent?.studioBrief).toContain('PI-TR-007')
  expect(sent?.studioBrief).toContain('Bleu / Ivoire')
  expect(JSON.stringify(sent)).not.toMatch(
    /factory|supplier|S-PE|TS-0|source-pe/,
  )
  await page.screenshot({
    path: `/tmp/studio-lot51-${info.project.name}-summary.png`,
    fullPage: true,
  })
})
