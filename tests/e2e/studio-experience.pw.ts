import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const screenshots = '/tmp/lot52-review'
mkdirSync(screenshots, { recursive: true })
test('homepage : promesse, matières, navigation et mobile', async ({
  page,
}, info) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Votre mobilier',
  )
  await expect(
    page.getByRole('link', { name: 'Créer mon projet dans le Studio' }),
  ).toBeVisible()
  await expect(page.getByLabel('Revue locale')).toContainText('DONNÉES TEST')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBe(0)
  await page.screenshot({
    path: `${screenshots}/home-${info.project.name}.png`,
    fullPage: true,
    style: '#local-design-review { position: static !important; }',
  })
  await page.screenshot({
    path: `${screenshots}/home-${info.project.name}-viewport.png`,
  })
  await page.getByRole('button', { name: /Le relief du cordage/ }).click()
  await expect(page.getByAltText('Échantillon réel PI-RP-060')).toBeVisible()
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Ouvrir le menu' }),
    ).toBeFocused()
  }
  await page
    .getByRole('link', { name: 'Créer mon projet dans le Studio' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Créez votre projet' }),
  ).toBeVisible()
  await expect(
    page.getByTestId('entry-full-project').locator('img'),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByTestId('entry-full-project')
        .locator('img')
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true)
  await page.screenshot({
    path: `${screenshots}/studio-${info.project.name}.png`,
    fullPage: true,
    style: '#local-design-review { position: static !important; }',
  })
  await page.screenshot({
    path: `${screenshots}/studio-${info.project.name}-viewport.png`,
  })
  await page
    .getByLabel('Revue locale')
    .getByRole('link', { name: 'Recommencer' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Créez votre projet' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Reprendre ma planche' }),
  ).not.toBeVisible()
})
test('atelier : exploration progressive, planche multiple et projet à confirmer', async ({
  page,
}, info) => {
  await page.goto('/__design/project', { waitUntil: 'networkidle' })
  await expect(
    page.getByLabel('Les matières de mon projet').getByRole('button'),
  ).toHaveCount(2)
  const library = page
    .locator('details')
    .filter({
      has: page
        .locator('summary')
        .filter({ hasText: 'Ouvrir la bibliothèque' }),
    })
    .first()
  await expect(library).not.toHaveAttribute('open', '')
  await expect(
    page.getByRole('region', { name: 'La matière en détail' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Matière suivante' }).click()
  await expect(
    page.getByAltText('Matière PI-TR-008', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retenir cette piste' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'PI-TR-008 retenu' }),
  ).toBeVisible()
  await page.screenshot({
    path: `${screenshots}/selection-${info.project.name}.png`,
    fullPage: true,
    style: '#local-design-review { position: static !important; }',
  })
  await page
    .getByLabel('Les matières de mon projet')
    .getByRole('button')
    .filter({ hasText: 'Assise démo 2' })
    .click()
  await expect(page.getByLabel('Votre planche matière')).toContainText(
    'PI-RP-060',
  )
  await page
    .getByLabel('Les matières de mon projet')
    .getByRole('button')
    .filter({ hasText: 'Assise démo 1' })
    .click()
  await expect(page.getByLabel('Couleurs du tressage souhaitées')).toHaveValue(
    '',
  )
  await page.getByLabel('Couleurs du tressage souhaitées').fill('Bleu / Ivoire')
  await page.getByRole('button', { name: 'Noter cette palette' }).click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.screenshot({
    path: `${screenshots}/atelier-${info.project.name}.png`,
    fullPage: true,
    style: '#local-design-review { position: static !important; }',
  })
  await page.screenshot({
    path: `${screenshots}/atelier-${info.project.name}-viewport.png`,
  })
  await page
    .locator('summary')
    .filter({ hasText: 'Ouvrir la bibliothèque' })
    .click()
  await expect(page.getByRole('button', { name: /^Agrandir PI/ })).toHaveCount(
    12,
  )
  await page
    .getByRole('button', { name: 'Comparer PI-TR-007', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Comparer PI-TR-003', exact: true })
    .click()
  await page.getByRole('button', { name: 'Comparer les 2 détails' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({
    path: `${screenshots}/comparison-${info.project.name}.png`,
  })
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Résumé et envoi', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Votre projet, prêt à être étudié' }),
  ).toBeVisible()
  await expect(
    page.getByText('Montant à vérifier', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('main')).toContainText('Ivoire souhaité')
  await page.screenshot({
    path: `${screenshots}/project-${info.project.name}.png`,
    fullPage: true,
    style: '#local-design-review { position: static !important; }',
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBe(0)
})
test('revue locale isolée, données privées inaccessibles et reduced motion', async ({
  page,
  request,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/studio/assises', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('decision-card')).toBeVisible()
  expect(
    await page
      .getByTestId('decision-card')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
  await page.screenshot({
    path: `${screenshots}/discovery-${info.project.name}.png`,
    fullPage: true,
    style: '#local-design-review { position: static !important; }',
  })
  for (const path of [
    '/data/private/studio-visual-library/manifest.json',
    '/data/private/studio-visual-library/source-pe.jpg',
  ])
    expect((await request.get(path)).status()).toBeGreaterThanOrEqual(400)
  const contact = await request.post('/api/contact', {
    data: { name: 'Démo', message: 'Ne pas envoyer' },
  })
  expect(await contact.json()).toEqual({ ok: true, demo: true })
  expect((await request.post('/_serverFn/test', { data: {} })).status()).toBe(
    403,
  )
  const direct = await request.get('http://localhost:5197/__design/project')
  expect(direct.status()).toBe(404)
  expect(await direct.text()).not.toContain('local-design-review')
})

test('les modèles circulent, peuvent être arrêtés et respectent reduced motion', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const showcase = page.getByRole('region', {
    name: 'Explorer les modèles du catalogue',
  })
  await expect(
    showcase.getByText('Tressage rosé', { exact: true }),
  ).toBeVisible({ timeout: 6000 })
  await showcase
    .getByRole('button', { name: 'Mettre les modèles en pause' })
    .click()
  await page.mouse.move(0, 0)
  const selected = await showcase
    .locator('[data-position="0"] img')
    .getAttribute('src')
  await page.waitForTimeout(3300)
  await expect(showcase.locator('[data-position="0"] img')).toHaveAttribute(
    'src',
    selected!,
  )
  await showcase.getByRole('button', { name: 'Modèle suivant' }).click()
  await expect(showcase.locator('[data-position="0"] img')).not.toHaveAttribute(
    'src',
    selected!,
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload({ waitUntil: 'networkidle' })
  await expect(
    showcase.getByRole('button', { name: 'Mettre les modèles en pause' }),
  ).toHaveCount(0)
  expect(
    await showcase
      .locator('[data-position="0"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s')
  await expect(page.getByAltText('Terrassea — plaque dorée')).toBeVisible()
  const sample = page.getByAltText('Échantillon réel PI-TR-007')
  await sample.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      sample.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true)
  expect(
    await sample.evaluate(
      (img: HTMLImageElement) => img.clientWidth - 16 <= img.naturalWidth,
    ),
  ).toBe(true)
})
