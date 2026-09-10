/* global URL, console */
// Deterministic crops only: no recoloring, generation, sharpening or texture synthesis.
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
const root = new URL('../../', import.meta.url)
const privateRoot = new URL('data/private/studio-visual-library/', root)
const output = new URL('public/studio/materials/', root)
await mkdir(output, { recursive: true })
const { items } = JSON.parse(
  await readFile(new URL('manifest.json', privateRoot), 'utf8'),
)
const publicItems = []
for (const item of items) {
  const filename = item.public_ref.toLowerCase()
  const crop = sharp(new URL(item.source, privateRoot).pathname)
    .extract(item.crop)
    .toColourspace('srgb')
  await crop
    .clone()
    .webp({ quality: 92 })
    .toFile(new URL(filename + '-detail.webp', output).pathname)
  await crop
    .clone()
    .resize({
      width: 128,
      height: 128,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toFile(new URL(filename + '.webp', output).pathname)
  publicItems.push({
    public_ref: item.public_ref,
    family: item.family,
    label:
      { weave: 'Tressage', textilene: 'Textilène', rope: 'Cordage' }[
        item.family
      ] +
      ' ' +
      item.public_ref.slice(-3),
    thumbnail: '/studio/materials/' + filename + '.webp',
    image: '/studio/materials/' + filename + '-detail.webp',
    tag: item.tag,
    active: true,
    color_customization: 'unknown',
    color_zones: null,
  })
}
// Explicit public allowlist. Never serialize the private row or source metadata.
await writeFile(
  new URL('library.json', output),
  JSON.stringify(publicItems, null, 2) + '\n',
)
for (const family of ['weave', 'textilene', 'rope']) {
  const rows = publicItems.filter((i) => i.family === family)
  const tiles = await Promise.all(
    rows.map(async (i, n) => ({
      input: await sharp(
        new URL(i.thumbnail.slice(1), new URL('public/', root)).pathname,
      )
        .resize(110, 100, { fit: 'contain', background: '#eee9df' })
        .toBuffer(),
      left: (n % 8) * 114,
      top: Math.floor(n / 8) * 104,
    })),
  )
  await sharp({
    create: {
      width: 912,
      height: Math.ceil(rows.length / 8) * 104,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(tiles)
    .png()
    .toFile('/tmp/studio-material-audit-' + family + '.png')
}
console.log(
  `Extracted ${publicItems.length} public samples; private references stay outside public/`,
)
