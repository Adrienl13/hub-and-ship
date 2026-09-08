// Mesures déterministes partagées par canvas et sharp. Aucun label de style.
export const DECISION_PIPELINE_VERSION = 'decision-v1'
export const DECISION_MARGIN = 0.07
export const DECISION_SIZES = [1200, 600]
const clamp = (n) => Math.max(0, Math.min(1, n))

export function analyzePackshot(data, width, height, channels = 4) {
  if (width < 2 || height < 2 || data.length !== width * height * channels)
    throw new Error('Invalid pixels')
  const rgb = (x, y) => {
    const i = (y * width + x) * channels
    return [data[i], data[i + 1], data[i + 2]]
  }
  const white = (v) => v.every((n) => n >= 242)
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]
  const background = corners.filter(([x, y]) => white(rgb(x, y))).length / 4
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1
  let count = 0,
    sum = 0,
    square = 0,
    edges = 0,
    differences = 0
  const colors = new Map()
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const pixel = rgb(x, y)
      if (white(pixel)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      const gray = (pixel[0] + pixel[1] + pixel[2]) / 765
      count++
      sum += gray
      square += gray * gray
      if (x > 0) {
        const left = rgb(x - 1, y)
        const diff = Math.abs(gray - (left[0] + left[1] + left[2]) / 765)
        if (diff > 0.12) edges++
        differences += diff
      }
      const key = pixel
        .map((n) =>
          Math.min(255, Math.floor(n / 32) * 32 + 16)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
      colors.set(key, (colors.get(key) ?? 0) + 1)
    }
  if (!count) return null
  const w = maxX - minX + 1,
    h = maxY - minY + 1
  // Buffer conservateur autour du contenu : ne découpe pas au bord du produit.
  const pad = Math.max(2, Math.ceil(Math.max(width, height) * 0.005))
  const box = {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: 0,
    h: 0,
  }
  box.w = Math.min(width, maxX + 1 + pad) - box.x
  box.h = Math.min(height, maxY + 1 + pad) - box.y
  const center =
    1 -
    Math.min(
      1,
      Math.hypot((minX + w / 2) / width - 0.5, (minY + h / 2) / height - 0.5) *
        2,
    )
  const frame = Math.max(w / width, h / height)
  const margin = Math.min(
    minX / width,
    minY / height,
    (width - 1 - maxX) / width,
    (height - 1 - maxY) / height,
  )
  const sharpness = clamp((differences / count) * 12)
  return {
    box,
    background,
    quality: { background, center, frame, margin, sharpness },
    quality_score: clamp(
      0.3 * background +
        0.2 * center +
        0.2 * clamp(1 - Math.abs(frame - 0.86)) +
        0.3 * sharpness,
    ),
    traits: {
      silhouette_ratio: w / h,
      edge_density: edges / count,
      global_contrast: clamp(
        Math.sqrt(Math.max(0, square / count - (sum / count) ** 2)) * 2,
      ),
      dominant_colors: [...colors]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([hex, n]) => ({ hex: `#${hex}`, proportion: n / count })),
      // Proxies de fond visible et de variation locale, pas des faits produit.
      openness: clamp(1 - count / (w * h)),
      pattern_score: clamp((differences / count) * 4),
    },
  }
}

export function decisionPlacement(box, size) {
  const scale = (size * (1 - 2 * DECISION_MARGIN)) / Math.max(box.w, box.h)
  const width = Math.round(box.w * scale),
    height = Math.round(box.h * scale)
  return {
    width,
    height,
    left: Math.floor((size - width) / 2),
    top: Math.floor((size - height) / 2),
  }
}
