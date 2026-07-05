export const PARTNER_CONTEXT_STORAGE_KEY =
  'container-club-partner-link-context'

export const PARTNER_CONTEXT_TTL_DAYS = 120

export interface PartnerLinkContext {
  readonly slug: string
  readonly displayName: string
  readonly sourcePath: string
  readonly selectionId: string | null
  readonly capturedAt: string
  readonly expiresAt: string
}

export interface PartnerContextStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem?: (key: string) => void
}

export function normalizePartnerSlug(value: string | null | undefined) {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(normalized)
    ? normalized
    : null
}

export function partnerDisplayNameFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) =>
      part.length <= 3
        ? part.toUpperCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

export function buildPartnerSharePath({
  slug,
  selectionId,
}: {
  readonly slug: string
  readonly selectionId?: string | null
}) {
  const normalizedSlug = normalizePartnerSlug(slug)
  if (!normalizedSlug) return '/partenaires'
  return selectionId
    ? `/p/${normalizedSlug}?selection=${encodeURIComponent(selectionId)}`
    : `/p/${normalizedSlug}`
}

export function createPartnerLinkContext({
  slug,
  sourcePath,
  selectionId = null,
  now = new Date(),
}: {
  readonly slug: string
  readonly sourcePath: string
  readonly selectionId?: string | null
  readonly now?: Date
}): PartnerLinkContext | null {
  const normalizedSlug = normalizePartnerSlug(slug)
  if (!normalizedSlug) return null

  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + PARTNER_CONTEXT_TTL_DAYS)

  return {
    slug: normalizedSlug,
    displayName: partnerDisplayNameFromSlug(normalizedSlug),
    sourcePath,
    selectionId: selectionId?.trim() ? selectionId.trim().slice(0, 80) : null,
    capturedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

function isPartnerLinkContext(value: unknown): value is PartnerLinkContext {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PartnerLinkContext>
  return (
    typeof candidate.slug === 'string' &&
    Boolean(normalizePartnerSlug(candidate.slug)) &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.sourcePath === 'string' &&
    typeof candidate.capturedAt === 'string' &&
    typeof candidate.expiresAt === 'string' &&
    (candidate.selectionId === null || typeof candidate.selectionId === 'string')
  )
}

function readContextFromRaw(raw: string | null): PartnerLinkContext | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPartnerLinkContext(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function readPartnerLinkContext({
  storage,
  now = new Date(),
}: {
  readonly storage: PartnerContextStorage
  readonly now?: Date
}): PartnerLinkContext | null {
  const context = readContextFromRaw(
    storage.getItem(PARTNER_CONTEXT_STORAGE_KEY),
  )

  if (!context) return null
  if (Date.parse(context.expiresAt) < now.getTime()) {
    storage.removeItem?.(PARTNER_CONTEXT_STORAGE_KEY)
    return null
  }

  return context
}

export function writePartnerLinkContext({
  storage,
  context,
}: {
  readonly storage: PartnerContextStorage
  readonly context: PartnerLinkContext
}) {
  storage.setItem(PARTNER_CONTEXT_STORAGE_KEY, JSON.stringify(context))
}

export function getPartnerSlugFromUrl(url: URL) {
  const pathMatch = url.pathname.match(/^\/p\/([^/]+)\/?$/)
  const slugFromPath = normalizePartnerSlug(pathMatch?.[1])
  if (slugFromPath) return slugFromPath

  return (
    normalizePartnerSlug(url.searchParams.get('partner')) ??
    normalizePartnerSlug(url.searchParams.get('partner_slug')) ??
    normalizePartnerSlug(url.searchParams.get('revendeur'))
  )
}

export function capturePartnerLinkContextFromUrl({
  storage,
  url,
  now = new Date(),
}: {
  readonly storage: PartnerContextStorage
  readonly url: URL
  readonly now?: Date
}) {
  const slug = getPartnerSlugFromUrl(url)
  if (!slug) return readPartnerLinkContext({ storage, now })

  const context = createPartnerLinkContext({
    slug,
    sourcePath: `${url.pathname}${url.search}${url.hash}`,
    selectionId: url.searchParams.get('selection'),
    now,
  })
  if (!context) return readPartnerLinkContext({ storage, now })

  writePartnerLinkContext({ storage, context })
  return context
}
