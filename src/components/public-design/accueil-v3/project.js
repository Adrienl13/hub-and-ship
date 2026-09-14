// Canonical reference/design/quantity handoff. No price copied from browser storage.
export function validateProject(input, data) {
  if (!input || !Array.isArray(input.lines)) return null
  const lines = []
  for (const row of input.lines.slice(0, 500)) {
    const product = data.products.find(
      (p) => p.sku === row.ref && p.visibility !== 'on_request',
    )
    if (
      !product ||
      !Number.isInteger(row.qty) ||
      row.qty <= 0 ||
      row.qty > 100000
    )
      continue
    const variant = data.variants.find(
      (v) => v.product_id === product.id && v.id === row.designId,
    )
    const defaultAllowed =
      !data.variants.some((v) => v.product_id === product.id) &&
      row.designId === product.id + ':principal'
    if (!variant && !defaultAllowed) continue
    const min = variant?.min_order_units || product.moq_units
    if (!Number.isInteger(min) || min <= 0 || row.qty < min) continue
    lines.push({
      ref: product.sku,
      designId: row.designId,
      design: variant?.name || 'Design catalogue',
      qty: row.qty,
    })
  }
  return lines.length
    ? { lines, delivery: input.delivery === 'depot' ? 'depot' : 'terrasse' }
    : null
}
