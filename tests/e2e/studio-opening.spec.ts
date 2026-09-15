import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  // Live anonymous reads only. Block telemetry and all form writes during QA.
  await page.route('**/*', (route) =>
    !['GET', 'HEAD'].includes(route.request().method())
      ? route.abort()
      : route.continue(),
  )
})
test('home opens Studio without preview and keeps the full footer', async ({
  page,
}) => {
  await page.goto('/')
  const entry = page
    .getByRole('link', { name: 'Créer mon projet', exact: false })
    .first()
  await expect(entry).toHaveAttribute('href', '/studio')
  await entry.click()
  await expect(
    page.getByRole('heading', { name: 'Créez votre projet' }),
  ).toBeVisible()
  await expect(page.getByRole('note')).toContainText('avant toute commande')
  await expect(page.locator('footer')).toHaveCount(1)
  await expect(
    page.getByRole('link', { name: 'Conditions générales de vente' }),
  ).toHaveAttribute('href', '/legal/cgv')
  await page.getByTestId('entry-seats').click()
  await expect(page).toHaveURL(/studio\/assises/)
  await expect(
    page.getByRole('heading', {
      name: 'Quelles assises pour votre établissement ?',
    }),
  ).toBeVisible({ timeout: 20000 })
  await expect(page.locator('body')).not.toContainText('Page introuvable')
})
test('tables and customization remain accessible with absent advanced data', async ({
  page,
}) => {
  for (const route of ['/studio/tables', '/studio/personnalisation']) {
    const response = await page.goto(route)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('note')).toContainText('Préparez votre projet')
    await expect(page.locator('footer')).toHaveCount(1)
    await expect(page.locator('body')).not.toContainText('Application error')
  }
})
test('17 likes in fallback mode always offer an explicit next step', async ({
  page,
}) => {
  await page.goto('/studio/assises')
  for (let i = 1; i <= 17; i++) {
    await page.getByRole('button', { name: /^J'aime :/ }).click()
    await expect(page.getByTestId('discovery-next-step')).toContainText(
      `${i} assise`,
    )
  }
  await page
    .getByRole('button', {
      name: 'Comparer mes choix et continuer',
      exact: true,
    })
    .click()
  await expect(page.getByTestId('discovery-next-step')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: /pistes|finalistes/i }).first(),
  ).toBeVisible()
})
test('partner form has wide fields and no nested trust panel', async ({
  page,
}) => {
  await page.goto('/partenaires')
  const slot = page.locator('[data-form-slot="partner"]')
  await expect(
    slot.getByText('Pourquoi les pros nous font confiance'),
  ).toHaveCount(0)
  const field = slot.getByPlaceholder('Ex. Distri Boissons Provence')
  await field.fill('Distribution Terrasse Provence')
  expect((await field.boundingBox())?.width).toBeGreaterThan(200)
  const siret = slot.getByPlaceholder('14 chiffres')
  await siret.fill('98826998100011')
  expect((await siret.boundingBox())?.width).toBeGreaterThan(160)
  await expect(siret).toHaveValue('98826998100011')
})
