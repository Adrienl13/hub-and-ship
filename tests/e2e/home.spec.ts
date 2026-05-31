import { expect, test } from '@playwright/test'

test('home page renders the Session 0 shell', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      name: 'Mobilier outdoor pro, direct usine, sans intermédiaire.',
    }),
  ).toBeVisible()
  await expect(
    page.locator('#catalogue').getByText('Catalogue', { exact: true }),
  ).toBeVisible()
})

test('interactive 3D container loads only after activation', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chrome',
    'The desktop sidebar owns the interactive 3D activation control.',
  )

  const containerSceneRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/src/components/ContainerScene.tsx')) {
      containerSceneRequests.push(url)
    }
  })

  await page.goto('/catalogue')
  await expect(page.getByText('Aperçu logistique').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(containerSceneRequests).toHaveLength(0)

  await page.getByRole('button', { name: 'Activer 3D' }).click()

  await expect
    .poll(() =>
      containerSceneRequests.some((url) => url.includes('ContainerScene')),
    )
    .toBe(true)
})
