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

import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import sharp from 'sharp'

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

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
  console.error('Usage: node scripts/normalize-packshots.mjs <dossier> […]')
  process.exit(1)
}

for (const dir of dirs) {
  const entries = await readdir(dir)
  let done = 0
  let skipped = 0
  for (const entry of entries) {
    const path = join(dir, entry)
    if (!(await stat(path)).isFile()) continue
    if (!['.webp', '.jpg', '.jpeg', '.png'].includes(extname(entry).toLowerCase()))
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
