/* global console, process */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
const walk = async (dir) =>
  (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat()
const markers = [
  'seedReviewProject',
  'design-review-local-only',
  'local-design-review',
  '/__design/project',
]
let failed = false
for (const root of ['dist/client', 'dist/server'])
  for (const file of await walk(root)) {
    if (!/\.(?:js|mjs|html|json)$/.test(file)) continue
    const text = await readFile(file, 'utf8')
    if (markers.some((marker) => text.includes(marker))) {
      console.error(`Design review leak in ${file}`)
      failed = true
    }
  }
if (failed) process.exit(1)
console.log(
  'Design review isolation ok: no demo launcher, fixture key or review endpoint in production artifacts.',
)
