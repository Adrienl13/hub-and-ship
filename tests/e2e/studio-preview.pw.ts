import { expect, test } from '@playwright/test'

const KEY = 'studio-preview-navigation-test-only'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/studio/events', (route) => route.fulfill({ status: 202, body: '{}' }))
})

test('preview valide : accès initial puis vraie navigation TanStack vers les assises', async ({ page, context }) => {
  const response = await page.goto(`/studio/preview?key=${KEY}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByTestId('entry-seats')).toBeVisible()
  await page.waitForLoadState('networkidle')
  const check = page.waitForRequest((request) => new URL(request.url()).pathname.startsWith('/_serverFn/'))
  await page.getByTestId('entry-seats').click()
  const serverRequest = await check
  expect(await serverRequest.headerValue('cookie')).toContain('studio_preview=')
  await expect(page).toHaveURL(/\/studio\/assises\?entry=seats$/)
  await expect(page.getByTestId('studio-shell')).toBeVisible()
  const cookie = (await context.cookies()).find((entry) => entry.name === 'studio_preview')!
  expect(cookie.path).toBe('/')
  expect(cookie.httpOnly).toBe(true)
  expect(cookie.sameSite).toBe('Lax')
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(7 * 24 * 3600 - 60)
  expect(await page.evaluate(() => document.cookie)).not.toContain('studio_preview')
})

test('flag OFF : sans cookie ou cookie forgé, les deux routes restent 404', async ({ context }) => {
  for (const path of ['/studio', '/studio/assises']) {
    expect((await context.request.get(path)).status()).toBe(404)
  }
  await context.addCookies([{ name: 'studio_preview', value: '9999999999.forged', domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }])
  for (const path of ['/studio', '/studio/assises']) {
    expect((await context.request.get(path)).status()).toBe(404)
  }
})

test('clear efface la preview courante et le cookie historique Path=/studio', async ({ context }) => {
  await context.request.get(`/studio/preview?key=${KEY}`)
  const cookie = (await context.cookies()).find((entry) => entry.name === 'studio_preview')!
  // Un navigateur déjà connecté avant le hotfix peut encore porter ce scope.
  await context.addCookies([{ ...cookie, path: '/studio' }])
  const clear = await context.request.get('/studio/preview?clear=1', { maxRedirects: 0 })
  expect(clear.status()).toBe(302)
  expect((await context.cookies()).filter((entry) => entry.name === 'studio_preview')).toEqual([])
  for (const path of ['/studio', '/studio/assises']) {
    expect((await context.request.get(path)).status()).toBe(404)
  }
})
