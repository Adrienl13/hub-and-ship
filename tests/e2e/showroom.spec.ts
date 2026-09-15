import { test, expect } from '@playwright/test'
// Synthetic fixtures only; all non-read requests not explicitly mocked are blocked.
const publicId = '10000000-0000-4000-8000-000000000001'
const requestId = '10000000-0000-4000-8000-000000000002'
const base = {
  city: 'Lyon',
  postal_code: '69002',
  latitude: 45.75,
  longitude: 4.85,
  description: 'Lieu synthétique de test',
  visit_info: 'Sur les horaires de l’établissement',
  product_skus: ['BIS-002'],
  photo_paths: [],
}
const places = [
  {
    ...base,
    id: publicId,
    name: 'Terrasse test',
    address: '1 rue de test',
    visibility: 'public',
  },
  {
    ...base,
    id: requestId,
    name: 'Lieu équipé à Lyon',
    address: null,
    visibility: 'on_request',
  },
]
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (r) =>
    !['GET', 'HEAD'].includes(r.request().method()) ? r.abort() : r.continue(),
  )
  await page.route('**/rest/v1/rpc/list_public_showroom_locations', (r) =>
    r.fulfill({ json: places }),
  )
  await page.route('https://geo.api.gouv.fr/communes?**', (r) =>
    r.fulfill({
      json: [
        {
          nom: 'Lyon',
          code: '69123',
          codesPostaux: ['69002'],
          centre: { coordinates: [4.85, 45.75] },
        },
      ],
    }),
  )
  // A blocked tile provider must not prevent the accessible results list.
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
})
test('map lists real record shapes, selects a public venue and opens its route', async ({
  page,
}) => {
  await page.goto('/lieux')
  await expect(
    page.getByRole('heading', { name: /La confiance se vit/ }),
  ).toBeVisible()
  await page.locator('.showroom-results').getByRole('button', { name: /Terrasse test/ }).click()
  const detail = page.getByRole('region', { name: 'Détails du lieu' })
  await expect(detail).toContainText('1 rue de test')
  await expect(
    detail.getByRole('link', { name: /Itinéraire/ }),
  ).toHaveAttribute('href', /destination=45.75%2C4.85/)
  await expect(detail).toContainText('photos de ce lieu seront ajoutées')
  await expect(page.locator('footer')).toHaveCount(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
})
test('on-request selection has no itinerary and opens a contact brief without URL data', async ({
  page,
}) => {
  await page.goto('/lieux')
  await page.locator('.showroom-results').getByRole('button', { name: /Lieu équipé à Lyon/ }).click()
  const detail = page.getByRole('region', { name: 'Détails du lieu' })
  await expect(detail.getByRole('link', { name: /Itinéraire/ })).toHaveCount(0)
  await detail.getByRole('button', { name: 'Organiser une visite' }).click()
  const request = page.getByRole('region', { name: 'Organiser une visite' })
  await expect(
    request.getByRole('textbox', { name: /Votre message/ }),
  ).toHaveValue(new RegExp(requestId))
  await expect(page).toHaveURL(/\/lieux$/)
})
test('city search, radius and photo filters give a recoverable empty result', async ({
  page,
}) => {
  await page.goto('/lieux')
  await page.getByPlaceholder('Ex. Lyon ou 69002').fill('69002')
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click()
  await page.getByRole('button', { name: 'Lyon · 69002' }).click()
  await expect(
    page.getByText('2 lieux à découvrir autour de Lyon'),
  ).toBeVisible()
  await page.getByLabel('Avec photos').check()
  await expect(
    page.getByRole('heading', { name: 'Aucun lieu dans cette sélection.' }),
  ).toBeVisible()
  await page.getByLabel('Avec photos').uncheck()
  await page.getByRole('button', { name: 'Toute la France' }).click()
  await expect(
    page.locator('.showroom-results').getByRole('button', { name: /Terrasse test/ }),
  ).toBeVisible()
})
test('no invented locations when the registry is empty or unavailable', async ({
  page,
}) => {
  await page.route('**/rest/v1/rpc/list_public_showroom_locations', (r) =>
    r.fulfill({ json: [] }),
  )
  await page.goto('/lieux')
  await expect(
    page.getByRole('heading', { name: 'Les premiers lieux arrivent bientôt.' }),
  ).toBeVisible()
  await page.route('**/rest/v1/rpc/list_public_showroom_locations', (r) =>
    r.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'La carte se prépare.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Parlons de votre projet →' }),
  ).toBeVisible()
})
