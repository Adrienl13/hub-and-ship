// This adapter never borrows another product's photo or a price from the mockup.
const categories = {
  chair: 'Chaise',
  armchair: 'Fauteuil',
  table: 'Table',
  table_top: 'Table',
  table_base: 'Table',
  bench: 'Banc',
  lounge: 'Salon & lounge',
}
const kinds = {
  ...categories,
  table_top: 'Plateau',
  table_base: 'Piètement de table',
}
const money = (v) =>
  v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0
    ? Number(v)
    : null
export const minimum = (p, i) => p.variantMoq?.[i] || p.moq
export function adaptCatalogue(data) {
  if (!Array.isArray(data.products) || !Array.isArray(data.variants))
    throw new Error('Catalogue invalide')
  const prices = new Map(
    (data.prices || []).map((p) => [p.product_id, money(p.unit_price_ht)]),
  )
  return data.products
    .filter((p) => p.visibility !== 'on_request' && categories[p.category])
    .map((p) => {
      const variants = data.variants.filter((v) => v.product_id === p.id)
      const features = Array.isArray(p.features) ? p.features : []
      const family = features.some((f) => /textil[èe]ne/i.test(f))
        ? 'Textilène'
        : features.some((f) => /cordage/i.test(f))
          ? 'Cordage'
          : features.some((f) => /tressage|cannage/i.test(f))
            ? 'Tressage'
            : null
      const stock = (data.stock || []).filter(
        (s) => s.product_id === p.id && s.available_units > 0,
      )
      // A default design uses only the actual main image, never a fictitious colour.
      const vs = variants.length
        ? variants
        : [
            {
              id: p.id + ':principal',
              name: 'Design catalogue',
              image_url: p.main_image_url,
            },
          ]
      return {
        id: p.id,
        ref: p.sku,
        name: p.name,
        cat: categories[p.category],
        kind: kinds[p.category],
        material: family || 'Famille à préciser',
        usage: features.find((f) => /^usage\b/i.test(f)) || 'À préciser',
        frame:
          features.find((f) => /^structure\b/i.test(f)) ||
          'Structure à préciser',
        stack: features.find((f) => /empilable/i.test(f)) || 'À préciser',
        price: prices.get(p.id) ?? money(p.base_price_ht),
        moq:
          Number.isInteger(p.moq_units) && p.moq_units > 0 ? p.moq_units : null,
        img: p.main_image_url || '',
        gallery: p.gallery_urls || [],
        variants: vs.map((v) => [
          v.name,
          '',
          v.image_url || p.main_image_url || '',
        ]),
        variantGalleries: vs.map((v) =>
          Array.isArray(v.gallery_urls) ? v.gallery_urls : [],
        ),
        variantIds: vs.map((v) => v.id),
        variantMoq: vs.map((v) =>
          Number.isInteger(v.min_order_units) && v.min_order_units > 0
            ? v.min_order_units
            : null,
        ),
        stock: stock.length > 0,
        stockVariantIds: stock.map((s) => s.variant_id),
        stockKnown: data.stock !== null,
        tag: null,
        isNew: false,
      }
    })
}
export function sanitizeCart(input, products, identities = null) {
  if (!Array.isArray(input)) return []
  const rows = new Map()
  for (const row of input.slice(0, 500)) {
    if (
      !row ||
      typeof row.ref !== 'string' ||
      !Number.isInteger(row.varIdx) ||
      !Number.isInteger(row.qty) ||
      row.qty <= 0 ||
      row.qty > 100000
    )
      continue
    const p = products.find((p) => p.ref === row.ref)
    if (
      !p ||
      row.varIdx < 0 ||
      row.varIdx >= p.variants.length ||
      !minimum(p, row.varIdx)
    )
      continue
    const key = row.ref + ':' + row.varIdx
    if (row.key !== key || row.qty < minimum(p, row.varIdx)) continue
    if (identities && identities[key] !== p.variantIds[row.varIdx]) continue
    // Reject repeated keys rather than doubling quantities from malformed storage.
    if (!rows.has(key))
      rows.set(key, { key, ref: row.ref, varIdx: row.varIdx, qty: row.qty })
  }
  return [...rows.values()]
}
export function estimate(cart, products) {
  const pieces = cart.reduce((n, r) => n + r.qty, 0),
    rate = pieces >= 150 ? 0.1 : pieces >= 100 ? 0.06 : 0
  const known = cart.every((r) =>
    Number.isFinite(products.find((p) => p.ref === r.ref)?.price),
  )
  const subtotal = known
    ? cart.reduce(
        (n, r) => n + r.qty * products.find((p) => p.ref === r.ref).price,
        0,
      )
    : null
  return {
    pieces,
    rate,
    subtotal,
    total: known ? Math.round(subtotal * (1 - rate) * 100) / 100 : null,
  }
}
