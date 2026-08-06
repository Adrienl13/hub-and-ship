// Normalisation automatique des packshots à l'UPLOAD admin (miroir client du
// script scripts/normalize-packshots.mjs) : toute photo produit sur fond
// blanc est recadrée puis recentrée sur un canevas CARRÉ blanc à marge
// constante — les vignettes de designs et les grilles restent alignées sans
// retouche manuelle. Les photos d'ambiance (coins non blancs) passent
// inchangées.

const MARGIN_RATIO = 0.07
const WHITE_THRESHOLD = 242
const CONTENT_THRESHOLD = 243 // pixel « contenu » si un canal < seuil

function cornersAreWhite(data: ImageData): boolean {
  const probe = Math.min(6, data.width - 1, data.height - 1)
  const at = (x: number, y: number) => {
    const i = (y * data.width + x) * 4
    return [data.data[i]!, data.data[i + 1]!, data.data[i + 2]!]
  }
  const corners: ReadonlyArray<readonly [number, number]> = [
    [probe, probe],
    [data.width - 1 - probe, probe],
    [probe, data.height - 1 - probe],
    [data.width - 1 - probe, data.height - 1 - probe],
  ]
  return corners.every(([x, y]) =>
    at(x, y).every((channel) => channel >= WHITE_THRESHOLD),
  )
}

function contentBoundingBox(
  data: ImageData,
): { x: number; y: number; w: number; h: number } | null {
  let minX = data.width
  let minY = data.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const i = (y * data.width + x) * 4
      if (
        data.data[i]! < CONTENT_THRESHOLD ||
        data.data[i + 1]! < CONTENT_THRESHOLD ||
        data.data[i + 2]! < CONTENT_THRESHOLD
      ) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/**
 * Retourne un fichier WebP carré fond blanc à marge constante quand `file`
 * est un packshot (coins blancs), sinon le fichier d'origine tel quel.
 * Tout échec (format exotique, canvas indisponible) rend l'original :
 * l'upload ne doit JAMAIS être bloqué par la normalisation.
 */
export async function normalizePackshotFile(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) return file
    // Fond blanc d'abord : les PNG transparents deviennent des packshots.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)

    if (!cornersAreWhite(pixels)) return file
    const box = contentBoundingBox(pixels)
    if (!box) return file

    const side = Math.round(Math.max(box.w, box.h) / (1 - MARGIN_RATIO * 2))
    const output = document.createElement('canvas')
    output.width = side
    output.height = side
    const outContext = output.getContext('2d')
    if (!outContext) return file
    outContext.fillStyle = '#ffffff'
    outContext.fillRect(0, 0, side, side)
    outContext.drawImage(
      canvas,
      box.x,
      box.y,
      box.w,
      box.h,
      Math.round((side - box.w) / 2),
      Math.round((side - box.h) / 2),
      box.w,
      box.h,
    )

    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, 'image/webp', 0.92),
    )
    if (!blob) return file
    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
