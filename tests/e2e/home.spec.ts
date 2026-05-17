import { expect, test } from '@playwright/test'

test('home page renders the Session 0 shell', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Container Club' })).toBeVisible()
  await expect(page.getByText('Demo pricing')).toBeVisible()
})
