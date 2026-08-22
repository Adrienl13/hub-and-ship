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

// Scan anti-fuite : le bundle client est public (même les chunks admin).
// Aucun marqueur d'économie interne (marges d'achat) ni de fournisseur ne
// doit y survivre — src/lib/pricing/channel-economics.ts ne doit être
// importé que par des données chargées au runtime, jamais inliné.
const LEAK_PATTERNS = [
  { label: 'CHANNEL_MARGIN_RATES (module admin-only inliné)', pattern: /CHANNEL_MARGIN_RATES/ },
  { label: 'marges canaux en dur (revendeur/distributeur)', pattern: /distributeur:0?\.28|revendeur:0?\.4[,}]/ },
  { label: 'référence fournisseur (nom)', pattern: /chouvant|lion[-_]design/i },
  { label: 'référence fournisseur (SKU usine ZF)', pattern: /ZF\d{4}/ },
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

let leakCount = 0
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const content = await readFile(join(CLIENT_ASSETS_DIR, file), 'utf8')
  for (const leak of LEAK_PATTERNS) {
    const match = content.match(leak.pattern)
    if (match) {
      console.error(
        `Leak scan failed: ${leak.label} dans ${file} (« ${match[0]} »)`,
      )
      hasFailure = true
      leakCount += 1
    }
  }
}
console.log(
  leakCount === 0
    ? `Leak scan ok: aucun marqueur interne dans ${files.filter((f) => f.endsWith('.js')).length} chunks client.`
    : `Leak scan: ${leakCount} fuite(s) détectée(s).`,
)

if (hasFailure) {
  process.exit(1)
}
