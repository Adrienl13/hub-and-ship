// E2E Studio Assises (lot 2). Le serveur de dev tourne avec le flag ON et
// une URL Supabase FACTICE ; les surfaces publiques Studio sont interceptées
// et servies par des fixtures de test (aucune donnée de production, aucune
// donnée inventée présentée comme réelle). L'API d'événements est
// interceptée aussi : on vérifie qu'elle reçoit des lots valides.
//
//   VITE_STUDIO_ENABLED=true VITE_SUPABASE_URL=https://fake-supabase.test \
//   VITE_SUPABASE_ANON_KEY=fake bunx playwright test tests/e2e/studio.spec.ts

import { expect, test, type Page, type Locator } from '@playwright/test'

const SUPABASE = 'https://fake-supabase.test'

interface FixtureSeat {
  id: string
  sku: string
  category: 'chair' | 'armchair'
  name: string
  material: string
  seat_kind: string
  moq_units: number
  base_price_ht: string
}

const SEATS: FixtureSeat[] = [
  { id: 'e2e-001', sku: 'E2E-001', category: 'chair', name: 'Chaise TEST UN', material: 'pe_weave', seat_kind: 'chair', moq_units: 50, base_price_ht: '62.00' },
  { id: 'e2e-002', sku: 'E2E-002', category: 'chair', name: 'Chaise TEST DEUX', material: 'rope', seat_kind: 'chair', moq_units: 50, base_price_ht: '99.00' },
  { id: 'e2e-003', sku: 'E2E-003', category: 'armchair', name: 'Fauteuil TEST TROIS', material: 'textilene', seat_kind: 'armchair', moq_units: 50, base_price_ht: '89.00' },
  { id: 'e2e-004', sku: 'E2E-004', category: 'chair', name: 'Chaise TEST QUATRE', material: 'pe_weave', seat_kind: 'chair', moq_units: 50, base_price_ht: '70.00' },
  { id: 'e2e-005', sku: 'E2E-005', category: 'armchair', name: 'Fauteuil TEST CINQ', material: 'rope', seat_kind: 'armchair', moq_units: 50, base_price_ht: '120.00' },
  { id: 'e2e-006', sku: 'E2E-006', category: 'chair', name: 'Chaise TEST SIX', material: 'textilene', seat_kind: 'chair', moq_units: 50, base_price_ht: '75.00' },
]

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function productRow(seat: FixtureSeat, index: number) {
  return {
    id: seat.id,
    sku: seat.sku,
    category: seat.category,
    name: seat.name,
    description: 'Fixture de test E2E.',
    dim_length_cm: 48,
    dim_width_cm: 56,
    dim_height_cm: 86,
    cbm_per_unit: '0.08',
    weight_kg: '4.3',
    moq_units: seat.moq_units,
    base_price_ht: seat.base_price_ht,
    retail_price_ref: '149.00',
    eco_contribution: '0',
    main_image_url: PIXEL,
    gallery_urls: [PIXEL + '#second'],
    features: ['Empilable'],
    fire_rating: 'M2',
    is_active: true,
    sort_order: index,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    table_shape: null,
    compatible_top_shapes: [],
    visibility: 'public',
    studio_role: 'seat',
    seat_kind: seat.seat_kind,
    material: seat.material,
    model_family_id: null,
    visual_traits: null,
    data_quality: { price: { status: 'verified', source: 'catalogue_public_price' } },
  }
}

async function mockStudioBackend(page: Page, events: unknown[]) {
  await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop() ?? ''
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    switch (table) {
      case 'studio_products':
        return json(SEATS.map(productRow))
      case 'product_variants':
        return json(
          SEATS.map((seat) => ({
            id: `${seat.id}-std`,
            product_id: seat.id,
            name: 'Standard',
            image_url: PIXEL,
            gallery_urls: [],
            sort_order: 0,
            created_at: '2026-09-01T00:00:00Z',
            min_order_units: null,
          })),
        )
      case 'studio_fulfillment_options_public':
        return json(
          SEATS.map((seat) => ({
            id: `opt-${seat.id}`,
            product_id: seat.id,
            variant_id: null,
            mode: 'standard_production',
            min_quantity: seat.moq_units,
            max_quantity: null,
            price_basis: 'container',
            source: 'seed_moq',
            is_active: true,
            is_confirmed: false,
            available_from: null,
            expires_at: null,
          })),
        )
      case 'stock_lines':
        // Stock réel : 10 unités sur E2E-002 seulement.
        return json([
          { id: 'stock-e2e-002', product_id: 'e2e-002', variant_id: 'e2e-002-std', available_units: 10, stock_price_ht: '70' },
        ])
      case 'studio_curation_sets_public':
        return json([])
      case 'studio_diagnostic_pairs_public':
        return json([])
      default:
        return json([])
    }
  })
  await page.route(`${SUPABASE}/auth/v1/**`, (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/api/studio/events', async (route) => {
    events.push(route.request().postDataJSON())
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true,"inserted":1}' })
  })
}

async function assertStudioTargets(root: Locator) {
  const targets = root.locator('button, a[href], input, select, textarea, [role="button"]')
  for (const target of await targets.all()) {
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    const label = await target.getAttribute('aria-label') ?? await target.textContent()
    expect(box?.width ?? 0, `largeur : ${label}`).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0, `hauteur : ${label}`).toBeGreaterThanOrEqual(44)
  }
}

test.describe('Studio Assises (flag ON, surfaces interceptées)', () => {
  test('parcours complet : entrée → découverte → favoris → finalistes → choix → quantité 6 → projet, avec Undo et clavier', async ({ page }, testInfo) => {
    const events: Array<{ sessionId: string; algorithmVersion: string; events: Array<{ type: string; payload?: Record<string, unknown> }> }> = []
    await mockStudioBackend(page, events)
    // Sous 1024 px (mobile et tablette), le rail devient la barre basse.
    const isMobile = (page.viewportSize()?.width ?? 1280) < 1024 || testInfo.project.name === 'mobile-chrome'

    await page.goto('/studio')
    await expect(page.getByRole('heading', { name: /Le mobilier de votre projet commence ici/ })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.getByTestId('entry-seats').click()
    await expect(page).toHaveURL(/\/studio\/assises\?entry=seats$/)

    // Première compilation de la route par le serveur de dev : délai élargi.
    const card = page.getByTestId('decision-card')
    await expect(card).toBeVisible({ timeout: 30_000 })

    // Aucun débordement horizontal.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await assertStudioTargets(page.getByTestId('studio-shell'))
    const firstName = await card.getByRole('heading').textContent()
    // Aucun prix pendant la découverte.
    await expect(card).not.toContainText('€')
    // Actions visibles et ≥ 44 px.
    for (const label of [/^Pas pour moi :/, /^Passer :/, /^J'aime :/]) {
      const box = await page.getByRole('button', { name: label }).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    // J'aime (clic), puis Pas pour moi (clavier), puis Passer (clavier).
    await page.getByRole('button', { name: /^J'aime :/ }).click()
    await expect(card.getByRole('heading')).not.toHaveText(firstName ?? '')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowDown')
    await expect(card).toContainText('Choix 4')

    // Undo restaure la carte précédente (3/6), puis Z aussi.
    await page.getByRole('button', { name: 'Annuler la dernière action' }).click()
    await expect(card).toContainText('Choix 3')
    await page.keyboard.press('z')
    await expect(card).toContainText('Choix 2')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    // Favoris : 3 j'aime.
    const tray = page.getByRole('region', { name: 'Vos favoris' })
    await expect(tray).toContainText('(3)')

    await assertStudioTargets(tray)

    // Finalistes : ≤ 3, prix visible, choix explicite.
    await tray.getByRole('button', { name: 'Vos finalistes' }).click()
    const finalists = page.getByTestId('finalists')
    await expect(finalists).toBeVisible()
    const count = await finalists.getByRole('listitem').count()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)
    await expect(finalists).toContainText('€')
    await assertStudioTargets(finalists)
    await finalists.getByRole('button', { name: 'Choisir cette assise' }).first().click()

    // Quantité libre : 6 sous un MOQ de 50, jamais bloqué, retour explicite.
    await expect(page.getByTestId('quantity-stage')).toBeVisible()
    const quantity = page.getByLabel('Quantité souhaitée')
    await quantity.fill('6')
    await expect(quantity).toHaveValue('6')
    const status = page.getByTestId('quantity-stage').getByRole('status')
    await expect(status).toContainText(/Disponible en stock|nous étudions la faisabilité/)
    await page.getByTestId('quantity-continue').click()
    await expect(card).toBeVisible()

    // Projet : rail desktop ou barre mobile, avec la quantité 6.
    if (isMobile) {
      await page.getByRole('button', { name: 'Ouvrir mon projet' }).click()
      const sheet = page.getByRole('dialog', { name: 'Mon projet' })
      await expect(sheet).toContainText('6 unités')
      await assertStudioTargets(sheet)
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
    } else {
      const rail = page.getByTestId('project-rail')
      await expect(rail).toContainText('6 unités')
      await assertStudioTargets(rail)
      await expect(rail.getByTestId('project-state')).toBeVisible()
    }

    // Rechargement : session et projet conservés.
    const sessionBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('terrassea-studio-v1') ?? '{}').state.sessionId)
    await page.reload()
    await expect(page.getByTestId('decision-card')).toBeVisible()
    const sessionAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('terrassea-studio-v1') ?? '{}').state.sessionId)
    expect(sessionAfter).toBe(sessionBefore)
    const items = await page.evaluate(() => JSON.parse(localStorage.getItem('terrassea-studio-v1') ?? '{}').state.project.items)
    expect(items).toHaveLength(1)
    expect(items[0].requestedQuantity).toBe(6)

    // Événements : lots valides, version portée, types attendus.
    await expect.poll(() => events.length).toBeGreaterThan(0)
    const types = events.flatMap((batch) => batch.events.map((event) => event.type))
    expect(types).toContain('studio_started')
    expect(types).toContain('card_liked')
    expect(types).toContain('undo')
    expect(types).toContain('finalists_viewed')
    expect(types).toContain('seat_selected')
    expect(types).toContain('quantity_changed')
    expect(types).not.toContain('project_completed')
    for (const batch of events) {
      expect(batch.algorithmVersion).toBe('v0.1')
      expect(batch.sessionId).toBe(sessionBefore)
    }
  })

  test('détails, favori depuis les détails, Escape ferme, noindex absent quand le flag est ON', async ({ page }) => {
    await mockStudioBackend(page, [])
    await page.goto('/studio/assises')
    await expect(page.getByTestId('decision-card')).toBeVisible()
    await page.keyboard.press('d')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).not.toContainText('€')
    await assertStudioTargets(dialog)
    await dialog.getByRole('button', { name: /Ajouter .* aux favoris/ }).click()
    await expect(dialog.getByRole('button', { name: /Retirer .* des favoris/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Vos favoris' })).toContainText('(1)')
    // Flag ON : aucune meta robots noindex (buildSeoHead ne l'émet pas).
    const robots = page.locator('meta[name="robots"]')
    if ((await robots.count()) > 0) {
      expect((await robots.first().getAttribute('content')) ?? '').not.toContain('noindex')
    }
  })

  test('?set=pilot ignoré avec flag public, même avec un jeu actif', async ({ page }) => {
    await mockStudioBackend(page, [])
    await page.route(`${SUPABASE}/rest/v1/studio_curation_sets_public*`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'pilot', label: 'Pilote', product_ids: ['e2e-001'] }]) }))
    await page.goto('/studio/assises?set=pilot')
    await expect(page.getByRole('status').filter({ hasText: /pilot/i })).toHaveCount(0)
    await expect(page.getByTestId('decision-card')).toContainText('Choix 1')
    const names = new Set<string>()
    for (let index = 0; index < 6; index++) {
      names.add(await page.getByTestId('decision-card').getByRole('heading').innerText())
      await page.getByRole('button', { name: /^Passer :/ }).click()
    }
    expect(names.size).toBe(6)
    await expect(page.getByTestId('discovery-exhausted')).toBeVisible()
  })

  test("l'échec de l'API d'événements ne casse pas le parcours", async ({ page }) => {
    await mockStudioBackend(page, [])
    await page.route('**/api/studio/events', (route) => route.fulfill({ status: 503, body: '{"ok":false}' }))
    await page.goto('/studio/assises')
    await page.getByRole('button', { name: /^J'aime :/ }).click()
    await expect(page.getByTestId('decision-card')).toContainText('Choix 2')
  })
})

test('projet persisté incomplet et candidat sans affinité : vérification et comparaison sans troisième finaliste', async ({ page }) => {
  await mockStudioBackend(page, [])
  await page.addInitScript(() => {
    localStorage.setItem('terrassea-studio-v1', JSON.stringify({
      version: 2,
      state: {
        sessionId: 's-review-e2e',
        project: { entry: 'seats', updatedAt: null, items: [
          { productId: 'e2e-002', variantId: 'e2e-002-std', role: 'seat', requestedQuantity: 6 },
          { productId: 'missing-reference', variantId: 'missing-design', role: 'seat', requestedQuantity: 4 },
        ] },
        discovery: { interactions: [], favoriteIds: ['e2e-001', 'e2e-002', 'e2e-003'], finalistIds: ['e2e-001', 'e2e-002'] },
        journal: [],
      },
    }))
  })
  await page.goto('/studio')
  const resume = page.getByRole('link', { name: 'Reprendre' })
  await expect(resume).toBeVisible()
  const resumeBox = await resume.boundingBox()
  expect(resumeBox?.height).toBeGreaterThanOrEqual(44)
  expect(resumeBox?.width).toBeGreaterThanOrEqual(44)
  await resume.click()
  await expect(page.getByTestId('decision-card')).toBeVisible()
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024
  if (mobile) await page.getByRole('button', { name: 'Ouvrir mon projet' }).click()
  const project = mobile ? page.getByRole('dialog', { name: 'Mon projet' }) : page.getByTestId('project-rail')
  await expect(project.getByRole('listitem')).toHaveCount(2)
  await expect(project).toContainText('Référence à vérifier')
  await expect(project).toContainText('Montant à vérifier')
  await expect(project.getByTestId('project-state')).toHaveText('Devis manuel')
  await assertStudioTargets(project)
  await project.getByRole('button', { name: 'Retirer la référence à vérifier du projet' }).click()
  await expect(project.getByRole('listitem')).toHaveCount(1)
  if (mobile) await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Vos finalistes' }).click()
  await page.getByRole('button', { name: 'Voir plus de finalistes' }).click()
  const more = page.getByTestId('more-finalists')
  await assertStudioTargets(more)
  await more.getByRole('button', { name: /Comparer/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const finalists = await page.evaluate(() => JSON.parse(localStorage.getItem('terrassea-studio-v1') ?? '{}').state.discovery.finalistIds)
  expect(finalists).toHaveLength(2)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('finalists').getByRole('listitem')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
