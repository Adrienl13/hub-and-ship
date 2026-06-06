import type { PartnerDealStatus } from '@/lib/partners/types'

export const PARTNER_ATTRIBUTABLE_DEAL_STATUSES = [
  'protected',
  'quoted',
  'reserved',
] as const satisfies ReadonlyArray<PartnerDealStatus>

export const GENERIC_EMAIL_DOMAINS = [
  'aol.com',
  'bbox.fr',
  'free.fr',
  'gmail.com',
  'gmx.com',
  'gmx.fr',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'laposte.net',
  'live.com',
  'mac.com',
  'me.com',
  'msn.com',
  'neuf.fr',
  'orange.fr',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'sfr.fr',
  'wanadoo.fr',
  'yahoo.com',
  'yahoo.fr',
] as const

export type PartnerAttributionReason =
  | 'client_siret'
  | 'client_email'
  | 'client_email_domain'

export interface PartnerAttributionInput {
  readonly siret?: string | null
  readonly contactEmail?: string | null
  readonly now?: Date | string
}

export interface PartnerAttributionCandidate {
  readonly id: string
  readonly status: PartnerDealStatus
  readonly clientSiret: string | null
  readonly clientEmail: string | null
  readonly partnerCompanyName: string
  readonly partnerContactEmail: string
  readonly protectedUntil: string | null
  readonly createdAt: string
}

export interface PartnerAttributionMatch {
  readonly dealId: string
  readonly reason: PartnerAttributionReason
  readonly matchedValue: string
  readonly partnerCompanyName: string
  readonly partnerContactEmail: string
  readonly protectedUntil: string
}

const ATTRIBUTABLE_STATUS_SET: ReadonlySet<PartnerDealStatus> = new Set(
  PARTNER_ATTRIBUTABLE_DEAL_STATUSES,
)

const GENERIC_EMAIL_DOMAIN_SET: ReadonlySet<string> = new Set(
  GENERIC_EMAIL_DOMAINS,
)

function toTimestamp(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(time) ? time : Number.NaN
}

export function normalizePartnerSiret(value: string | null | undefined) {
  const normalized = (value ?? '').replace(/\D/g, '')
  return normalized.length === 14 ? normalized : null
}

export function normalizePartnerEmail(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  return normalized
}

export function getPartnerEmailDomain(value: string | null | undefined) {
  const email = normalizePartnerEmail(value)
  if (!email) return null
  const domain = email.split('@')[1]?.replace(/\.$/, '') ?? ''
  return domain.length > 0 ? domain : null
}

export function isGenericPartnerEmailDomain(
  domain: string | null | undefined,
) {
  const normalized = (domain ?? '').trim().toLowerCase().replace(/\.$/, '')
  return GENERIC_EMAIL_DOMAIN_SET.has(normalized)
}

function isActiveCandidate(
  candidate: PartnerAttributionCandidate,
  now: Date,
) {
  if (!ATTRIBUTABLE_STATUS_SET.has(candidate.status)) return false
  if (!candidate.protectedUntil) return false
  const protectedUntil = Date.parse(candidate.protectedUntil)
  if (!Number.isFinite(protectedUntil)) return false
  return protectedUntil >= now.getTime()
}

function sortMostRecentFirst(
  candidates: ReadonlyArray<PartnerAttributionCandidate>,
) {
  return [...candidates].sort((left, right) => {
    const rightCreatedAt = toTimestamp(right.createdAt)
    const leftCreatedAt = toTimestamp(left.createdAt)
    return rightCreatedAt - leftCreatedAt
  })
}

function toMatch(
  candidate: PartnerAttributionCandidate,
  reason: PartnerAttributionReason,
  matchedValue: string,
): PartnerAttributionMatch | null {
  if (!candidate.protectedUntil) return null
  return {
    dealId: candidate.id,
    reason,
    matchedValue,
    partnerCompanyName: candidate.partnerCompanyName,
    partnerContactEmail: candidate.partnerContactEmail,
    protectedUntil: candidate.protectedUntil,
  }
}

export function findPartnerAttributionMatch(
  input: PartnerAttributionInput,
  candidates: ReadonlyArray<PartnerAttributionCandidate>,
): PartnerAttributionMatch | null {
  const now = input.now ? new Date(input.now) : new Date()
  const inputSiret = normalizePartnerSiret(input.siret)
  const inputEmail = normalizePartnerEmail(input.contactEmail)
  const inputDomain = getPartnerEmailDomain(input.contactEmail)
  const activeCandidates = sortMostRecentFirst(
    candidates.filter((candidate) => isActiveCandidate(candidate, now)),
  )

  if (inputSiret) {
    const siretMatch = activeCandidates.find(
      (candidate) => normalizePartnerSiret(candidate.clientSiret) === inputSiret,
    )
    if (siretMatch) {
      return toMatch(siretMatch, 'client_siret', inputSiret)
    }
  }

  if (inputEmail) {
    const emailMatch = activeCandidates.find(
      (candidate) =>
        normalizePartnerEmail(candidate.clientEmail) === inputEmail,
    )
    if (emailMatch) {
      return toMatch(emailMatch, 'client_email', inputEmail)
    }
  }

  if (inputDomain && !isGenericPartnerEmailDomain(inputDomain)) {
    const domainMatch = activeCandidates.find((candidate) => {
      const candidateDomain = getPartnerEmailDomain(candidate.clientEmail)
      return (
        candidateDomain === inputDomain &&
        !isGenericPartnerEmailDomain(candidateDomain)
      )
    })
    if (domainMatch) {
      return toMatch(domainMatch, 'client_email_domain', inputDomain)
    }
  }

  return null
}
