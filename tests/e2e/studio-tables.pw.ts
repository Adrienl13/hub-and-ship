import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
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
async function dimensions(page: Page, size = '70 × 70 cm') {
  await page
    .getByRole('button', { name: 'Rectangulaire / carré', exact: true })
    .click()
  await page.getByRole('button', { name: size, exact: true }).click()
  await page.getByRole('button', { name: /Marbre test.*Plateau test/ }).click()
  await expect(
    page.getByLabel('Quantité de tables', { exact: true }),
  ).toBeVisible()
}
async function summary(page: Page) {
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Ouvrir mon projet' }).click()
    return page.getByRole('dialog', { name: 'Mon projet' })
  }
  return page.getByTestId('project-rail')
}
async function screenshot(page: Page, name: string, project: string) {
  await mkdir('/tmp/studio-lot4-visual', { recursive: true })
  await page.evaluate(async () => {
    window.scrollTo(0, 0)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
  })
  for (const target of await page
    .locator('main')
    .locator('button,a[href],input,select,textarea')
    .all()) {
    if (!(await target.isVisible())) continue
    const box = await target.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
  }
  await page.waitForLoadState('networkidle')
  if (await page.getByTestId('decision-card').count())
    await expect(page.getByTestId('decision-card')).toHaveCSS('opacity', '1')
  await page.screenshot({
    path: `/tmp/studio-lot4-visual/${project}-${name}.png`,
    fullPage: false,
    animations: 'disabled',
  })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0)
}
test.beforeEach(async ({ page }) => {
  await backend(page)
})
test('projet complet, 60 assises, 30 tables, refresh et résumé commun', async ({
  page,
}, info) => {
  await page.goto('/studio')
  await expect(
    page.getByRole('heading', { name: 'Créez votre projet' }),
  ).toBeVisible()
  await page.waitForLoadState('networkidle')
  await screenshot(page, 'entry', info.project.name)
  await page.getByTestId('entry-full-project').click()
  await expect(page.getByTestId('decision-card')).toBeVisible()
  await screenshot(page, 'assises', info.project.name)
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: /^J'aime :/ }).click()
  await page
    .getByRole('region', { name: 'Vos favoris' })
    .getByRole('button', { name: 'Vos finalistes' })
    .click()
  await page
    .getByTestId('finalists')
    .getByRole('button', { name: 'Choisir cette assise' })
    .first()
    .click()
  await page.getByLabel('Quantité souhaitée').fill('60')
  await page
    .getByTestId('quantity-stage')
    .getByRole('link', { name: 'Continuer avec les tables' })
    .click()
  await dimensions(page)
  await expect(
    page.getByLabel('Quantité de tables', { exact: true }),
  ).toHaveValue('30')
  await expect(
    page.getByRole('button', { name: /Piètement non confirmé/ }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: /Piètement test validé.*Standard/ })
    .click()
  await screenshot(page, 'tables', info.project.name)
  await page.reload()
  await expect(
    page.getByLabel('Quantité de tables', { exact: true }),
  ).toHaveValue('30')
  const rail = await summary(page)
  await expect(
    rail.getByRole('spinbutton', { name: /^Quantité pour Assise/ }),
  ).toHaveValue('60')
  await expect(rail.getByTestId('project-table')).toContainText('Tables × 30')
  await expect(rail.getByTestId('project-table')).toContainText(
    'Configuration compatible',
  )
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await rail.getByLabel('Quantité de tables Plateau test 70').fill('17')
    await expect(rail.getByTestId('project-table')).toContainText('Tables × 17')
    await page.keyboard.press('Escape')
    await expect(rail).toBeHidden()
    await expect(page.getByTestId('project-bottom-bar')).toContainText(
      '77 éléments',
    )
  }
})
test('tables directes, quantité libre, invalidation et demande locale', async ({
  page,
}, info) => {
  await page.goto('/studio')
  await page.getByTestId('entry-tables').click()
  await dimensions(page)
  await expect(
    page.getByLabel('Quantité de tables', { exact: true }),
  ).toHaveValue('1')
  await page.getByLabel('Quantité de tables', { exact: true }).fill('17')
  await page
    .getByRole('button', { name: /Piètement test validé.*Standard/ })
    .click()
  await page.getByRole('button', { name: 'Changer le plateau' }).click()
  await dimensions(page, '120 × 80 cm')
  await expect(
    page.getByLabel('Quantité de tables', { exact: true }),
  ).toHaveValue('17')
  await expect(
    page.getByText(/Le piètement précédent n’est plus validé/),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Piètement test validé.*Standard/ }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Demander une vérification' }).click()
  await expect(
    page.getByText(/Aucune demande n’a encore été envoyée/),
  ).toBeVisible()
  await screenshot(page, 'unconfirmed', info.project.name)
  await page.reload()
  await expect(
    page.getByText(/Aucune demande n’a encore été envoyée/),
  ).toBeVisible()
})
test('sur mesure local, Escape et restitution du focus', async ({ page }) => {
  await page.goto('/studio/tables')
  const trigger = page.getByRole('button', { name: 'Autre dimension ?' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dialog.getByLabel('Longueur (cm)').fill('95')
  await dialog.getByLabel('Largeur (cm)').fill('65')
  await dialog.getByLabel('Matière / coloris souhaité').fill('Chêne')
  await dialog
    .getByRole('button', { name: 'Conserver dans mon projet' })
    .click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText(/Ce plateau sur mesure nécessite une étude/),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText(/Ce plateau sur mesure nécessite une étude/),
  ).toBeVisible()
})
