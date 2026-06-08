// Encode/decode a buyer cart selection into a compact, URL-safe string so a
// selection can be saved (bookmark) or shared. Format: comma-separated
// `productId~variantId~qty` triples. Product and variant ids are slugs
// (alphanumeric + dashes), so `~` and `,` are safe separators. Pure + tested.

export interface CartSelectionEntry {
  readonly productId: string
  readonly variantId: string
  readonly qty: number
}

const ITEM_SEP = ','
const FIELD_SEP = '~'
const MAX_ENTRIES = 50

export function encodeCartSelection(
  entries: ReadonlyArray<CartSelectionEntry>,
): string {
  return entries
    .filter((e) => e.qty > 0)
    .slice(0, MAX_ENTRIES)
    .map(
      (e) =>
        `${encodeURIComponent(e.productId)}${FIELD_SEP}${encodeURIComponent(
          e.variantId,
        )}${FIELD_SEP}${Math.max(1, Math.floor(e.qty))}`,
    )
    .join(ITEM_SEP)
}

export function decodeCartSelection(
  value: string | null | undefined,
): ReadonlyArray<CartSelectionEntry> {
  if (!value) return []
  const seen = new Set<string>()
  const entries: CartSelectionEntry[] = []
  for (const chunk of value.split(ITEM_SEP).slice(0, MAX_ENTRIES)) {
    const parts = chunk.split(FIELD_SEP)
    if (parts.length !== 3) continue
    const productId = decodeURIComponent(parts[0]!)
    const variantId = decodeURIComponent(parts[1]!)
    const qty = Number(parts[2])
    if (!productId || !variantId) continue
    if (!Number.isFinite(qty) || qty < 1) continue
    if (seen.has(productId)) continue
    seen.add(productId)
    entries.push({ productId, variantId, qty: Math.floor(qty) })
  }
  return entries
}
