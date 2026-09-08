/* global console, process */
// Normalise les packshots produit : même cadre blanc pour tous.
//
// Problème (retour admin 08/2026) : les photos de designs ont des marges
// blanches inégales — la grille et les vignettes paraissent bancales.
// Règle appliquée à chaque image d'un dossier :
//   1. Heuristique packshot : les 4 coins sont quasi blancs. Les photos
//      d'ambiance (fond réel) sont laissées INTACTES.
//   2. Trim des bords blancs → cadrage au produit seul.
//   3. Ré-expansion sur un canevas CARRÉ blanc avec une marge constante
//      (produit ≈ 86 % du côté) → tous les visuels ont le même fond plein
//      cadre, quelle que soit la photo d'origine.
//
// Usage : node scripts/normalize-packshots.mjs public/catalogue/bistro-seating-clean [autres dossiers…]
//         (réécrit les .webp/.jpg/.png en place, WebP qualité 92)

import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  analyzePackshot,
  decisionPlacement,
  DECISION_PIPELINE_VERSION,
  DECISION_SIZES,
} from '../src/lib/images/packshot-metrics.mjs'

const MARGIN_RATIO = 0.07 // marge de chaque côté (produit ≈ 86 % du côté)
const WHITE_THRESHOLD = 242 // coin considéré blanc si R,G,B ≥ seuil
const TRIM_THRESHOLD = 12 // tolérance du trim sharp vs blanc pur

async function cornersAreWhite(image, width, height) {
  const probe = 6 // taille de l'échantillon de coin
  const { data, info } = await image
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const px = (x, y) => {
    const i = (y * info.width + x) * info.channels
    return [data[i], data[i + 1], data[i + 2]]
  }
  const corners = [
    [probe, probe],
    [width - 1 - probe, probe],
    [probe, height - 1 - probe],
    [width - 1 - probe, height - 1 - probe],
  ]
  return corners.every(([x, y]) =>
    px(Math.max(0, x), Math.max(0, y)).every((c) => c >= WHITE_THRESHOLD),
  )
}

async function normalizeFile(path) {
  const source = sharp(path)
  const meta = await source.metadata()
  if (!meta.width || !meta.height) return 'illisible'

  if (!(await cornersAreWhite(source, meta.width, meta.height))) {
    return 'ambiance (intacte)'
  }

  // Trim des marges blanches existantes.
  const trimmed = await sharp(path)
    .flatten({ background: '#ffffff' })
    .trim({ background: '#ffffff', threshold: TRIM_THRESHOLD })
    .toBuffer()
  const trimmedMeta = await sharp(trimmed).metadata()
  const w = trimmedMeta.width ?? meta.width
  const h = trimmedMeta.height ?? meta.height

  // Canevas carré : le plus grand côté + marge constante des deux côtés.
  const side = Math.round(Math.max(w, h) / (1 - MARGIN_RATIO * 2))
  const left = Math.round((side - w) / 2)
  const top = Math.round((side - h) / 2)

  const output = await sharp(trimmed)
    .extend({
      top,
      bottom: side - h - top,
      left,
      right: side - w - left,
      background: '#ffffff',
    })
    .webp({ quality: 92 })
    .toBuffer()

  await sharp(output).toFile(path)
  return `normalisée ${meta.width}×${meta.height} → ${side}×${side}`
}

export async function normalizeDecisionBuffer(source) {
  const { data, info } = await sharp(source)
    .rotate()
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const analysis = analyzePackshot(data, info.width, info.height, info.channels)
  if (!analysis || analysis.background !== 1)
    throw new Error('Fond non neutre ou contenu absent : revue manuelle')
  const crop = await sharp(data, { raw: info })
    .extract({
      left: analysis.box.x,
      top: analysis.box.y,
      width: analysis.box.w,
      height: analysis.box.h,
    })
    .png()
    .toBuffer()
  const images = []
  for (const size of DECISION_SIZES) {
    const place = decisionPlacement(analysis.box, size)
    const buffer = await sharp(crop)
      .resize(place.width, place.height, { fit: 'fill' })
      .extend({
        top: place.top,
        left: place.left,
        bottom: size - place.top - place.height,
        right: size - place.left - place.width,
        background: '#ffffff',
      })
      .webp({ quality: 85 })
      .toBuffer()
    images.push(buffer)
  }
  // Traits sur une grille fixe, indépendante de la résolution fournisseur.
  const measure = await sharp(images[0])
    .resize(128, 128)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const traits = analyzePackshot(
    measure.data,
    128,
    128,
    measure.info.channels,
  ).traits
  return {
    images,
    analysis,
    traits,
    pipeline_version: DECISION_PIPELINE_VERSION,
  }
}

async function decisionBatch(args) {
  const value = (flag) => args[args.indexOf(flag) + 1]
  if (!args.includes('--manifest')) throw new Error('--manifest <JSON> requis')
  const manifest = JSON.parse(await readFile(value('--manifest'), 'utf8'))
  const output = resolve(
    args.includes('--output') ? value('--output') : '.cache/studio-decision',
  )
  const write = args.includes('--write')
  const results = [],
    errors = []
  for (const product of manifest.products) {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(product.product_id))
        throw new Error('Identifiant invalide')
      const source = await readFile(product.path)
      const hash = createHash('sha256').update(source).digest('hex')
      const directory = join(
        'studio',
        DECISION_PIPELINE_VERSION,
        product.product_id,
        hash,
      )
      const paths = ['decision.webp', 'thumb.webp'].map((name) =>
        join(directory, name),
      )
      // Reprise idempotente par hash source et version ; aucune réécriture source.
      const normalized = await normalizeDecisionBuffer(source)
      if (write) {
        await mkdir(join(output, directory), { recursive: true })
        for (const [index, path] of paths.entries())
          await writeFile(join(output, path), normalized.images[index])
      }
      results.push({
        product_id: product.product_id,
        source_url: product.source_url,
        source_hash: hash,
        pipeline_version: DECISION_PIPELINE_VERSION,
        status: 'pending',
        quality_score: normalized.analysis.quality_score,
        quality: normalized.analysis.quality,
        visual_traits: {
          ...normalized.traits,
          source_hash: hash,
          version: DECISION_PIPELINE_VERSION,
          provenance: 'pipeline',
          computed_at: manifest.computed_at ?? new Date().toISOString(),
        },
        paths,
      })
    } catch (error) {
      errors.push({ product_id: product.product_id, error: error.message })
    }
  }
  const report = {
    dry_run: !write,
    generated: results.length,
    errors,
    products: results,
  }
  if (write) {
    await mkdir(output, { recursive: true })
    await writeFile(
      join(output, 'decision-manifest.json'),
      JSON.stringify(report, null, 2),
    )
  }
  console.log(JSON.stringify(report, null, 2))
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--role')) {
    if (args[args.indexOf('--role') + 1] !== 'decision')
      throw new Error('Rôle inconnu')
    return decisionBatch(args)
  }
  const dirs = args
  if (dirs.length === 0)
    throw new Error(
      'Usage: node scripts/normalize-packshots.mjs <dossier> […] ou --role decision --manifest <JSON> [--write]',
    )
  for (const dir of dirs) {
    const entries = await readdir(dir)
    let done = 0,
      skipped = 0
    for (const entry of entries) {
      const path = join(dir, entry)
      if (
        !(await stat(path)).isFile() ||
        !['.webp', '.jpg', '.jpeg', '.png'].includes(
          extname(entry).toLowerCase(),
        )
      )
        continue
      try {
        const result = await normalizeFile(path)
        if (result.startsWith('normalisée')) done++
        else skipped++
      } catch (error) {
        console.error(`✗ ${path}: ${error.message}`)
      }
    }
    console.log(`${dir}: ${done} normalisées, ${skipped} laissées intactes`)
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
