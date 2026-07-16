/* global console, process */

// Import d'une catégorie fournisseur vers le format catalogue maison.
//
// Politique d'anonymisation (comme bistro-products.ts) : le fichier généré ne
// contient AUCUNE trace fournisseur — noms commerciaux français, SKU maison,
// photos rehébergées en local. La correspondance ref fournisseur → SKU maison
// est écrite dans un fichier .gitignoré (jamais commité).
//
// Usage :
//   node scripts/import-supplier-category.mjs \
//     --manifest lion-design.json \
//     --photos ./photos-lion \
//     --prefix LNG \
//     --collection-dir lounge-series \
//     --collection-label "Lounge" \
//     --out src/lib/lounge-products.ts
//
// Manifest : tableau JSON d'objets :
//   {
//     "supplierRef": "ZF9123C",          // sert UNIQUEMENT au mapping photos
//     "name": "Salon lounge RIVIERA - corde plate écru",
//     "category": "armchair",             // chair | armchair | table | bench
//     "variantName": "corde plate écru",
//     "l": 78, "w": 78, "h": 66,          // cm
//     "weightKg": 12.5,
//     "cbmPerUnit": 0.32,                 // optionnel (défaut l*w*h/1e6 arrondi)
//     "moqUnits": 20,                     // optionnel (défaut 50 chaises, 20 sinon)
//     "basePriceHt": 249,                 // prix public HT (canal direct)
//     "retailPriceRef": 449,              // équivalent retail FR barré
//     "ecoContribution": 0.5,             // optionnel (défaut 0.3)
//     "materialLine": "corde plate outdoor", // optionnel
//     "features": ["..."],                // optionnel (complétées par défauts)
//     "fireRating": "M2"                  // optionnel
//   }
//
// Photos : fichiers nommés <supplierRef>-<NN>.<ext> (ex. ZF9123C-01.jpg) ;
// la première (-01) devient l'image principale. Converties/copées en WebP vers
// public/catalogue/<collection-dir>/<PREFIX>-<NNN>-<NN>.webp (sharp requis
// pour la conversion des .jpg/.png ; les .webp sont copiés tels quels).

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const CATEGORIES = new Set(['chair', 'armchair', 'table', 'bench'])

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function fail(message) {
  console.error(`ERREUR: ${message}`)
  process.exit(1)
}

const manifestPath = arg('manifest') ?? fail('--manifest requis')
const photosDir = arg('photos') ?? fail('--photos requis')
const prefix = (arg('prefix') ?? fail('--prefix requis')).toUpperCase()
const collectionDir = arg('collection-dir') ?? fail('--collection-dir requis')
const collectionLabel = arg('collection-label') ?? prefix
const outPath = arg('out') ?? fail('--out requis')

if (!/^[A-Z]{2,4}$/.test(prefix)) fail('--prefix : 2 à 4 lettres (ex. LNG)')

const raw = JSON.parse(await readFile(manifestPath, 'utf8'))
if (!Array.isArray(raw) || raw.length === 0) fail('manifest vide')

// --- validation stricte : on n'invente JAMAIS une donnée produit -----------
const errors = []
raw.forEach((p, i) => {
  const where = `#${i + 1} (${p.supplierRef ?? p.name ?? '?'})`
  if (!p.supplierRef) errors.push(`${where}: supplierRef manquant`)
  if (!p.name) errors.push(`${where}: name manquant`)
  if (!CATEGORIES.has(p.category)) errors.push(`${where}: category invalide`)
  for (const k of ['l', 'w', 'h', 'weightKg', 'basePriceHt', 'retailPriceRef']) {
    if (typeof p[k] !== 'number' || !(p[k] > 0)) {
      errors.push(`${where}: ${k} manquant ou <= 0`)
    }
  }
  if (
    typeof p.retailPriceRef === 'number' &&
    typeof p.basePriceHt === 'number' &&
    p.retailPriceRef <= p.basePriceHt
  ) {
    errors.push(`${where}: retailPriceRef doit dépasser basePriceHt`)
  }
})
if (errors.length > 0) fail(`manifest invalide:\n- ${errors.join('\n- ')}`)

// --- photos : indexées par ref fournisseur ---------------------------------
const photoFiles = (await readdir(photosDir)).filter((f) =>
  /\.(webp|jpe?g|png)$/i.test(f),
)
function photosOf(supplierRef) {
  return photoFiles
    .filter((f) => f.toUpperCase().startsWith(`${supplierRef.toUpperCase()}-`))
    .sort()
}
for (const p of raw) {
  if (photosOf(p.supplierRef).length === 0) {
    fail(`aucune photo trouvée pour ${p.supplierRef} dans ${photosDir}`)
  }
}

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  if (photoFiles.some((f) => !f.toLowerCase().endsWith('.webp'))) {
    fail('sharp indisponible et photos non-WebP présentes — bun install sharp')
  }
}

const targetDir = join('public', 'catalogue', collectionDir)
await mkdir(targetDir, { recursive: true })

const slugBase = collectionLabel
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')

const products = []
const mapping = []

for (let index = 0; index < raw.length; index += 1) {
  const p = raw[index]
  const sku = `${prefix}-${String(index + 1).padStart(3, '0')}`
  const files = photosOf(p.supplierRef)

  const localPaths = []
  for (let shot = 0; shot < files.length; shot += 1) {
    const source = join(photosDir, files[shot])
    const targetName = `${sku}-${String(shot + 1).padStart(2, '0')}.webp`
    const target = join(targetDir, targetName)
    if (extname(files[shot]).toLowerCase() === '.webp') {
      await copyFile(source, target)
    } else {
      await sharp(source)
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(target)
    }
    localPaths.push(`/catalogue/${collectionDir}/${targetName}`)
  }

  const moqUnits = p.moqUnits ?? (p.category === 'chair' ? 50 : 20)
  const cbm =
    p.cbmPerUnit ?? Math.max(0.01, Math.round((p.l * p.w * p.h) / 10000) / 100)
  const material = p.materialLine ?? 'tressage PE outdoor'
  const description =
    `${p.name} pour restaurant, café, hôtel, brasserie, camping et terrasse CHR. ` +
    `Mobilier extérieur professionnel en ${material} et structure aluminium, ` +
    `dimensions ${p.l}x${p.w}x${p.h} cm, poids ${p.weightKg} kg. MOQ ${moqUnits} unités, ` +
    `achat groupé par container avec prix HT visible, photos produit et volume logistique. ` +
    `Coloris et finitions personnalisables sur projet en volume.`

  products.push({
    id: `${slugBase}-${sku.toLowerCase()}`,
    sku,
    category: p.category,
    name: p.name,
    description,
    dimensions: { l: p.l, w: p.w, h: p.h },
    cbmPerUnit: cbm,
    weightKg: p.weightKg,
    moqUnits,
    basePriceHt: p.basePriceHt,
    retailPriceRef: p.retailPriceRef,
    ecoContribution: p.ecoContribution ?? 0.3,
    mainImageUrl: localPaths[0],
    galleryUrls: localPaths.slice(1),
    variants: [
      {
        id: `${sku.toLowerCase()}-design-principal`,
        name: p.variantName ?? 'design principal',
        imageUrl: localPaths[0],
        galleryUrls: localPaths.slice(1),
        unitsCommitted: 0,
      },
    ],
    features:
      Array.isArray(p.features) && p.features.length > 0
        ? p.features
        : [
            `Collection ${collectionLabel}`,
            'Structure aluminium',
            material.charAt(0).toUpperCase() + material.slice(1),
            'Photos groupées par fiche produit',
            'Personnalisation gros projet',
            `MOQ ${moqUnits} unités`,
          ],
    fireRating: p.fireRating ?? 'M2',
  })
  mapping.push({ supplierRef: p.supplierRef, sku })
}

const exportName = `${slugBase.replace(/-/g, '_').toUpperCase()}_PRODUCTS`
const header =
  `import type { Product } from './products'\n\n` +
  `// Catalogue ${collectionLabel.toLowerCase()} anonymisé. Ne contient aucune source fournisseur.\n` +
  `// Photos locales groupées par SKU dans public/catalogue/${collectionDir}.\n` +
  `export const ${exportName}: Product[] = `

await writeFile(
  outPath,
  header + JSON.stringify(products, null, 2).replace(/"([a-zA-Z]\w*)":/g, '$1:') + '\n',
)

// Correspondance fournisseur — JAMAIS commitée (voir .gitignore).
const mappingPath = `supplier-mapping-${prefix.toLowerCase()}.json`
await writeFile(mappingPath, JSON.stringify(mapping, null, 2))

console.log(`OK: ${products.length} produits → ${outPath}`)
console.log(`OK: ${photoFiles.length} photos → ${targetDir}`)
console.log(`OK: correspondance (privée, non commitée) → ${mappingPath}`)
console.log(
  `\nÉtapes suivantes (je m'en charge) : brancher ${exportName} dans ` +
    `AdminCatalogueTab (startSortOrder suivant), ajouter la collection ` +
    `« ${collectionLabel} » (préfixe ${prefix}-) dans src/lib/collections.ts, ` +
    `gate + commit.`,
)
