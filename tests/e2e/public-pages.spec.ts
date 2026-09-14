import { test, expect } from '@playwright/test'
// Local-only public-route validation: never submit a real lead or application.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method()))
      return route.abort()
    return route.continue()
  })
})
for (const [path, heading] of [
  ['/', 'Votre lieu a du caractère.'],
  ['/catalogue', 'Du mobilier pensé'],
  ['/prix', 'On ne vous demande pas'],
  ['/partenaires', 'Vos clients ont des terrasses.'],
  ['/livres', 'La preuve'],
] as const) {
  test(`${path}: responsive live page and preserved footer`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(path)
    await expect(page.locator('.public-design')).toBeVisible()
    await expect(page.locator('h1').first()).toContainText(
      new RegExp(heading, 'i'),
    )
    await expect(page.locator('.public-design')).not.toContainText('{{', {
      timeout: 20000,
    })
    await expect(page.locator('footer')).toHaveCount(1)
    await expect(
      page.getByRole('link', { name: 'Mentions légales', exact: true }),
    ).toHaveAttribute('href', '/legal/mentions-legales')
    await expect(
      page.getByRole('button', { name: 'Gérer mes cookies' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}
test('catalogue selection reaches the real contact form without transmitting prices', async ({
  page,
}) => {
  await page.goto('/catalogue#produit-SKU-785')
  await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 20000 })
  // Product panel itself confirms the deep-link contract; no real order is placed.
  await expect(page.getByRole('dialog').first()).toContainText('QUIBERON')
  await page.goto('/#contact')
  await expect(
    page.getByRole('button', { name: 'Envoyer le message' }),
  ).toBeVisible()
  await expect(page.locator('.public-design')).not.toContainText(
    'Simulation uniquement',
  )
})
test('registry filters transit without delivered figures', async ({ page }) => {
  await page.goto('/livres')
  await page
    .getByRole('button', { name: 'En transit (1)', exact: true })
    .click({ timeout: 20000 })
  await expect(page.locator('.registry-card:visible')).toHaveCount(1)
  await expect(page.locator('.registry-card:visible')).toContainText(
    'Arrivée estimée',
  )
  await expect(page.locator('.registry-card:visible')).not.toContainText(
    'Articles livrés',
  )
})
test('Studio remains inaccessible without private preview', async ({
  request,
}) => {
  expect((await request.get('/studio')).status()).toBe(404)
  expect((await request.get('/studio/assises')).status()).toBe(404)
})
test('contact submission uses the real contract, with a mocked successful response', async ({
  page,
}) => {
  let submitted: Record<string, unknown> | undefined
  await page.route('**/api/contact', async (route) => {
    submitted = route.request().postDataJSON()
    await route.fulfill({ status: 200, json: { ok: true } })
  })
  await page.goto('/#contact')
  await page
    .getByRole('textbox', { name: 'Votre nom *', exact: true })
    .fill('Test intégration')
  await page
    .getByRole('textbox', { name: 'Email professionnel *', exact: true })
    .fill('integration@example.test')
  await page
    .getByRole('textbox', {
      name: 'Votre message * (produit, quantités, ville de livraison…)',
      exact: true,
    })
    .fill('Demande de mobilier pour notre terrasse à Paris.')
  await page.getByRole('button', { name: 'Envoyer le message' }).click()
  await expect(page.getByText('Message envoyé', { exact: true })).toBeVisible()
  expect(submitted?.name).toBe('Test intégration')
  expect(submitted?.message).toBe(
    'Demande de mobilier pour notre terrasse à Paris.',
  )
  expect(submitted).not.toHaveProperty('price')
})
test('container alert uses the existing RPC, mocked without any remote write', async ({
  page,
}) => {
  let submitted: Record<string, unknown> | undefined
  await page.route(
    '**/rest/v1/rpc/subscribe_container_notification',
    async (route) => {
      submitted = route.request().postDataJSON()
      await route.fulfill({ status: 200, json: null })
    },
  )
  await page.goto('/livres')
  const form = page.locator('.public-design form').first()
  await form.locator('input[type=email]').fill('integration@example.test')
  await form.getByRole('button', { name: 'M’avertir' }).click()
  await expect(page.locator('.public-design')).toContainText(
    'Inscription confirmée',
  )
  expect(submitted?.p_source).toBe('livres')
})
