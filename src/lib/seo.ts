import { CATEGORY_LABEL, type Product } from '@/lib/products'

export const SITE_URL = 'https://prosimport.com'
export const SITE_NAME = 'Container Club Terrassea'

export interface SeoInput {
  readonly title: string
  readonly description: string
  readonly path: string
  readonly image?: string
  readonly noindex?: boolean
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildSeoHead({
  title,
  description,
  path,
  image,
  noindex,
}: SeoInput) {
  const url = absoluteUrl(path)
  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`
  const imageUrl = image ? absoluteUrl(image) : undefined

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      ...(noindex
        ? [{ name: 'robots', content: 'noindex, nofollow' }]
        : []),
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: url },
      { property: 'og:locale', content: 'fr_FR' },
      {
        name: 'twitter:card',
        content: imageUrl ? 'summary_large_image' : 'summary',
      },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      ...(imageUrl
        ? [
            { property: 'og:image', content: imageUrl },
            { name: 'twitter:image', content: imageUrl },
          ]
        : []),
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

export function jsonLdScript(data: unknown) {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(data),
  }
}

export function breadcrumbJsonLd(
  items: ReadonlyArray<{ readonly name: string; readonly path: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function faqJsonLd(
  items: ReadonlyArray<{ readonly q: string; readonly a: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

export function articleJsonLd({
  title,
  description,
  path,
  datePublished,
  dateModified,
}: {
  readonly title: string
  readonly description: string
  readonly path: string
  readonly datePublished: string
  readonly dateModified?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    mainEntityOfPage: absoluteUrl(path),
    datePublished,
    dateModified: dateModified ?? datePublished,
    inLanguage: 'fr-FR',
    author: { '@type': 'Organization', name: 'Pros Import' },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

export function linkListJsonLd({
  name,
  path,
  items,
}: {
  readonly name: string
  readonly path: string
  readonly items: ReadonlyArray<{ readonly name: string; readonly path: string }>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: absoluteUrl(path),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

export function productJsonLd(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    image: [product.mainImageUrl, ...product.galleryUrls],
    description: product.description,
    category: CATEGORY_LABEL[product.category],
    brand: {
      '@type': 'Brand',
      name: 'Terrassea',
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'MOQ',
        value: `${product.moqUnits} unités`,
      },
      {
        '@type': 'PropertyValue',
        name: 'Volume unitaire',
        value: `${product.cbmPerUnit.toFixed(2)} m3`,
      },
      {
        '@type': 'PropertyValue',
        name: 'Dimensions',
        value: `${product.dimensions.l} x ${product.dimensions.w} x ${product.dimensions.h} cm`,
      },
    ],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: product.basePriceHt.toFixed(2),
      availability: 'https://schema.org/PreOrder',
      url: absoluteUrl('/catalogue'),
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        minValue: product.moqUnits,
        unitText: 'unités',
      },
    },
  }
}

export function itemListJsonLd({
  name,
  path,
  products,
}: {
  readonly name: string
  readonly path: string
  readonly products: ReadonlyArray<Product>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: absoluteUrl(path),
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: productJsonLd(product),
    })),
  }
}
