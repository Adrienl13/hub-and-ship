/* global URL, console, process */
// Local admin-only resolver. No network, no database writes.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const file = process.argv[2]
if (!file)
  throw Error(
    'Usage: node scripts/studio/resolve-visual-configuration.mjs /path/to/PI-C-dossier.json',
  )
const dossier = JSON.parse(await readFile(file, 'utf8'))
const canonical = (v) =>
  Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : v !== null && typeof v === 'object'
      ? '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
          .join(',') +
        '}'
      : JSON.stringify(v)
const expected =
  'PI-C-' +
  createHash('sha256')
    .update(canonical(dossier.snapshot))
    .digest('hex')
    .slice(0, 24)
    .toUpperCase()
if (dossier.reference !== expected)
  throw Error('Configuration reference mismatch; dossier may have changed')
const { items } = JSON.parse(
  await readFile(
    new URL(
      '../../data/private/studio-visual-library/manifest.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
const choices = Object.entries(dossier.snapshot.choices ?? {}).flatMap(
  ([target, rows]) =>
    rows
      .filter((r) => r.visual)
      .map((r) => {
        const source = items.find((i) => i.public_ref === r.visual.public_ref)
        return {
          target,
          public_ref: r.visual.public_ref,
          weave_colors_requested: r.visual.weave_colors,
          private_factory_ref: source?.factory_ref ?? null,
          private_source: source?.source ?? null,
          private_note:
            source?.private_note ??
            'Association produit et référence fournisseur à valider',
        }
      }),
)
console.log(
  JSON.stringify(
    {
      reference: expected,
      products: dossier.snapshot.items,
      tables: dossier.snapshot.tables,
      requested_choices: dossier.snapshot.choices,
      private_admin_choices: choices,
      approval: 'NOT_APPROVED',
    },
    null,
    2,
  ),
)
