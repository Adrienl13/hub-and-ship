/* global console, process */

import { readFile, readdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const CLIENT_ASSETS_DIR = join(process.cwd(), 'dist', 'client', 'assets')
const BUDGETS = [
  {
    label: 'ContainerScene lazy chunk',
    pattern: /^ContainerScene-[\w-]+\.js$/,
    maxBytes: 875 * 1024,
    maxGzipBytes: 245 * 1024,
  },
]

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`
}

const files = await readdir(CLIENT_ASSETS_DIR)
let hasFailure = false

for (const budget of BUDGETS) {
  const matches = files.filter((file) => budget.pattern.test(file))

  if (matches.length === 0) {
    console.error(`Bundle budget failed: ${budget.label} not found.`)
    hasFailure = true
    continue
  }

  for (const file of matches) {
    const filePath = join(CLIENT_ASSETS_DIR, file)
    const { size } = await stat(filePath)
    const gzipSize = gzipSync(await readFile(filePath)).length
    const status =
      size <= budget.maxBytes && gzipSize <= budget.maxGzipBytes
        ? 'ok'
        : 'failed'
    console.log(
      `Bundle budget ${status}: ${budget.label} ${formatKb(size)} raw <= ${formatKb(
        budget.maxBytes,
      )}, ${formatKb(gzipSize)} gzip <= ${formatKb(budget.maxGzipBytes)}`,
    )
    if (size > budget.maxBytes || gzipSize > budget.maxGzipBytes) {
      hasFailure = true
    }
  }
}

if (hasFailure) {
  process.exit(1)
}
