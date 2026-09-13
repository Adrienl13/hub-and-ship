/* global process, fetch, URL, AbortSignal */
// Fixed, anonymous, read-only queries. No service role or user session is used.
const tables = {
  products:
    'products_public?select=id,sku,name,category,base_price_ht,moq_units,main_image_url,gallery_urls,features,visibility,sort_order&is_active=eq.true&order=sort_order.asc,id.asc',
  variants:
    'product_variants?select=id,product_id,name,image_url,gallery_urls,min_order_units,sort_order&order=sort_order.asc,id.asc',
  stock:
    'stock_lines?select=product_id,variant_id,available_units&is_active=eq.true&available_units=gt.0',
}
export async function readCatalogue() {
  const origin = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!origin || !key)
    throw new Error('Public catalogue configuration unavailable')
  const base = new URL(origin)
  if (
    base.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(base.hostname)
  )
    throw new Error('Invalid public catalogue URL')
  const read = async (path) => {
    const response = await fetch(new URL('/rest/v1/' + path, base), {
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Public catalogue read failed')
    return response.json()
  }
  const pageAll = async (path) => {
    const rows = []
    for (let offset = 0; offset < 100000; offset += 1000) {
      const page = await read(path + `&limit=1000&offset=${offset}`)
      if (!Array.isArray(page))
        throw new Error('Invalid public catalogue response')
      rows.push(...page)
      if (page.length < 1000) return rows
    }
    throw new Error('Public catalogue pagination limit')
  }
  const [products, variants, stock, prices] = await Promise.all([
    pageAll(tables.products),
    pageAll(tables.variants),
    pageAll(tables.stock).catch(() => null),
    read('rpc/get_catalogue_prices').catch(() => null),
  ])
  return { products, variants, stock, prices }
}
