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
