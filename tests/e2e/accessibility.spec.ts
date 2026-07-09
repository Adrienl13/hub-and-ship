import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const ACCESSIBILITY_ROUTES: ReadonlyArray<string> = [
  '/',
  '/catalogue',
  '/stock-24h',
  '/contact',
  '/faq',
]

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(
    () => document.documentElement.dataset.hydrated === 'true',
  )
  await page.waitForTimeout(1_000)
}

function violationSummary(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }))
}

async function expectNoA11yViolations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0ms !important;
        scroll-behavior: auto !important;
      }
    `,
  })
  await page.waitForTimeout(100)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  expect(violationSummary(results.violations)).toEqual([])
}

test.describe('accessibility audit', () => {
  for (const path of ACCESSIBILITY_ROUTES) {
    test(`${path} has no critical WCAG A/AA violations`, async ({ page }) => {
      await gotoHydrated(page, path)

      await expect(page.locator('#contenu')).toHaveCount(1)
      await expect(page.locator('.skip-link')).toHaveAttribute(
        'href',
        '#contenu',
      )
      await expectNoA11yViolations(page)
    })
  }

  test('mobile navigation sheet remains accessible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydrated(page, '/catalogue')

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()

    await expect(
      page.getByRole('dialog', { name: 'Container Club' }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Navigation mobile' }),
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })

  test('product detail dialog remains accessible', async ({ page }) => {
    await gotoHydrated(page, '/catalogue')

    const detailButtons = page.locator('button[aria-label^="Voir détails"]')
    await expect
      .poll(() => detailButtons.count())
      .toBeGreaterThan(0)
    await detailButtons.first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
