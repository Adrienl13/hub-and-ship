import { expect, test, type Page } from '@playwright/test'

const PUBLIC_ROUTES: ReadonlyArray<{
  readonly path: string
  readonly heading: RegExp | string
}> = [
  { path: '/', heading: /Mobilier outdoor pro/ },
  { path: '/catalogue', heading: 'Vue compacte pour commander vite.' },
  {
    path: '/stock-24h',
    heading: 'Une solution rapide quand le container est trop loin.',
  },
  {
    path: '/stock-mobilier-terrasse-24h',
    heading: 'Mobilier de terrasse disponible rapidement pour les pros.',
  },
  { path: '/catalogue/chaises-restaurant', heading: /Vue compacte/ },
  { path: '/catalogue/tables-restaurant', heading: /Vue compacte/ },
  { path: '/faq', heading: "Tout ce qu'il faut savoir avant de réserver." },
  { path: '/qualite', heading: "Inspecté avant d'être expédié." },
  { path: '/livres', heading: 'La preuve par container.' },
  { path: '/livres/cc-2025-014', heading: 'CC-2025-014' },
  {
    path: '/transport-partenaires',
    heading: 'Transporteurs partenaires recommandés.',
  },
  { path: '/legal', heading: 'Transparence légale & protection.' },
  { path: '/legal/mentions-legales', heading: 'Mentions légales' },
  { path: '/legal/cgv', heading: 'Conditions générales de vente' },
  { path: '/legal/confidentialite', heading: 'Politique de confidentialité' },
  { path: '/legal/cookies', heading: 'Politique cookies' },
]

async function gotoHydrated(page: Page, path: string) {
  const response = await page.goto(path)
  await page.waitForFunction(
    () => document.documentElement.dataset.hydrated === 'true',
  )
  return response
}

test.describe('site audit parcours publics', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route.path}`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })

      const response = await gotoHydrated(page, route.path)

      expect(response?.status()).toBeLessThan(400)
      await expect(
        page.getByRole('heading', { name: route.heading }),
      ).toBeVisible()
      await expect(page.getByText('Page introuvable')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Erreur' })).toHaveCount(0)
      expect(consoleErrors).toEqual([])
    })
  }

  test('home internal links and anchors resolve', async ({ page, request }) => {
    await gotoHydrated(page, '/')

    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((nodes) =>
        Array.from(
          new Set(
            nodes
              .map((node) => node.getAttribute('href'))
              .filter((href): href is string =>
                Boolean(href?.startsWith('/') || href?.startsWith('#')),
              ),
          ),
        ),
      )

    for (const href of hrefs) {
      if (href.startsWith('#')) {
        await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1)
        continue
      }

      const response = await request.get(href)
      expect(response.status(), href).toBeLessThan(400)
    }
  })
})

test.describe('site audit parcours client', () => {
  test('catalogue order auto-upgrades to 40 foot and keeps 3D on demand', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop sidebar is the primary B2B ordering surface.',
    )

    const sceneRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/src/components/ContainerScene.tsx')) {
        sceneRequests.push(url)
      }
    })

    await gotoHydrated(page, '/catalogue')
    const chairRow = page
      .locator('article')
      .filter({ hasText: 'Chaise Cannes Empilable' })
      .first()

    await chairRow.getByLabel('Quantité').fill('400')

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('container-club-cart')
          if (!raw) return null
          return (
            JSON.parse(raw) as { state?: { preferredContainerType?: string } }
          ).state?.preferredContainerType
        }),
      )
      .toBe('40_hc')
    await expect(page.getByText('66 m³ utiles')).toBeVisible()
    expect(sceneRequests).toEqual([])

    await page.getByRole('button', { name: 'Activer 3D' }).click()
    await expect(
      page.locator('.shadow-paper').filter({ hasText: 'Votre commande' }),
    ).toBeVisible()
    await expect
      .poll(() => sceneRequests.some((url) => url.includes('ContainerScene')))
      .toBe(true)
  })

  test('reservation can be completed and stored locally when integrations are unavailable', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'Desktop sidebar is the primary B2B ordering surface.',
    )

    await gotoHydrated(page, '/catalogue')
    await page
      .getByRole('button', { name: /Confirmer ma réservation/ })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: 'Identification professionnelle' }),
    ).toBeVisible()

    await page.getByLabel('Numéro SIRET').fill('55208131701750')
    await page.getByRole('button', { name: 'Vérifier mon SIRET' }).click()
    await expect(page.getByText(/format SIRET est valide/i)).toBeVisible()
    await page.getByRole('button', { name: 'Continuer' }).click()

    await page.getByLabel('Nom complet *').fill('Adrien Laniez')
    await page.getByLabel('Société / établissement *').fill('Hotel Demo')
    await page.getByLabel('Email pro *').fill('direction@hotel-demo.fr')
    await page.getByLabel('Téléphone *').fill('+33 6 12 34 56 78')
    await page.getByRole('button', { name: 'Continuer' }).click()

    await page.getByRole('button', { name: 'Continuer' }).click()
    await page.getByRole('checkbox').click()
    await page.getByRole('button', { name: /Confirmer et payer/ }).click()

    await expect(page.getByText('Référence créée')).toBeVisible()
    await expect(page.getByText(/aperçu local/i)).toBeVisible()
    await page.getByRole('link', { name: 'Voir mes réservations' }).click()
    await expect(
      page.getByRole('heading', { name: 'Mes réservations' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /CC-2026-001-/ }).first(),
    ).toBeVisible()
  })
})

test.describe('site audit stock et admin', () => {
  test('stock 24h request is saved to the local admin fallback', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-chrome',
      'The current stock request form is validated through the desktop operations panel.',
    )

    await gotoHydrated(page, '/stock-24h')

    await page.getByPlaceholder('Société').fill('Restaurant Audit')
    await page
      .getByPlaceholder('Email professionnel')
      .fill('achat@restaurant-audit.fr')
    await page.getByPlaceholder('Téléphone').fill('+33 6 00 00 00 00')
    await page.getByPlaceholder(/Quantité souhaitée/).fill('1')
    const submit = page.getByRole('button', { name: /Être rappelé/ })
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText('Demande stock préparée')).toBeVisible()
    await expect(page.getByText('Restaurant Audit')).toBeVisible()
  })

  test('admin route fails closed when Supabase auth is not fully configured', async ({
    page,
  }) => {
    await gotoHydrated(page, '/admin')

    await expect(
      page.getByRole('heading', { name: 'Authentification indisponible' }),
    ).toBeVisible()
    await expect(page.getByText('VITE_SUPABASE_URL')).toBeVisible()
    await expect(page.getByText('VITE_SUPABASE_ANON_KEY')).toBeVisible()
  })
})
