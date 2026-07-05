import { z } from 'zod'

import type {
  PartnerApplicationInsertPayload,
  PartnerDealInsertPayload,
  PartnerKind,
} from '@/lib/partners/types'

export const LOCAL_PARTNER_SUBMISSIONS_KEY =
  'container-club-partner-submissions'

export const partnerSubmissionSchema = z.object({
  mode: z.enum(['application', 'deal']),
  partnerKind: z.enum([
    'introducer',
    'reseller',
    'agency',
    'installer',
    'network',
    'other',
  ]),
  companyName: z.string().trim().min(2, 'Société obligatoire').max(180),
  contactName: z.string().trim().min(2, 'Nom obligatoire').max(140),
  contactEmail: z
    .string()
    .trim()
    .email('Email professionnel invalide')
    .max(254),
  contactPhone: z.string().trim().min(6, 'Téléphone obligatoire').max(40),
  siret: z.string().trim().max(20).optional().nullable(),
  website: z.string().trim().max(240).optional().nullable(),
  territory: z.string().trim().max(180).optional().nullable(),
  networkDescription: z.string().trim().max(700).optional().nullable(),
  expectedMonthlyVolume: z.string().trim().max(120).optional().nullable(),
  // Extension fusion — champs de la page /partenaires (mockup) + attribution
  // first-touch, persistés via la migration partner_applications_extend.
  activityProfile: z.string().trim().max(40).optional().nullable(),
  targetStatus: z
    .enum(['apporteur', 'revendeur', 'grand_compte', 'distributeur', 'nsp'])
    .optional()
    .nullable(),
  utmSource: z.string().trim().max(255).optional().nullable(),
  utmMedium: z.string().trim().max(255).optional().nullable(),
  utmCampaign: z.string().trim().max(255).optional().nullable(),
  partnerRef: z.string().trim().max(255).optional().nullable(),
  message: z.string().trim().max(900).optional().nullable(),
  clientCompanyName: z.string().trim().max(180).optional().nullable(),
  clientSiret: z.string().trim().max(20).optional().nullable(),
  clientEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  projectCity: z.string().trim().max(160).optional().nullable(),
  projectType: z.string().trim().max(180).optional().nullable(),
  expectedBudgetHt: z
    .number()
    .nonnegative()
    .max(5_000_000)
    .optional()
    .nullable(),
  expectedPurchaseWindow: z.string().trim().max(120).optional().nullable(),
  productInterest: z.string().trim().max(700).optional().nullable(),
  protectionDays: z.number().int().min(30).max(365).optional().nullable(),
  now: z.string().datetime().optional(),
})

export type PartnerSubmissionInput = z.input<typeof partnerSubmissionSchema>
export type PartnerSubmissionData = z.infer<typeof partnerSubmissionSchema>

export interface PartnerSubmissionDraft {
  readonly localId: string
  readonly mode: 'application' | 'deal'
  readonly application: PartnerApplicationInsertPayload
  readonly deal: PartnerDealInsertPayload | null
  readonly createdAt: string
}

export interface PartnerSubmissionStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('fr-FR')
}

function compactDate(date: Date): string {
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('.', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .slice(0, 14)
}

function createLocalId({
  mode,
  companyName,
  now,
}: {
  readonly mode: PartnerSubmissionDraft['mode']
  readonly companyName: string
  readonly now: Date
}): string {
  const slug = companyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `partner-${mode}-${slug || 'prospect'}-${compactDate(now)}`
}

function isPartnerSubmissionDraft(
  value: unknown,
): value is PartnerSubmissionDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PartnerSubmissionDraft>
  return (
    typeof candidate.localId === 'string' &&
    (candidate.mode === 'application' || candidate.mode === 'deal') &&
    typeof candidate.application?.company_name === 'string'
  )
}

function validateDealFields(data: PartnerSubmissionData): string | null {
  if (data.mode !== 'deal') return null
  if (!emptyToNull(data.clientCompanyName)) return 'Société client obligatoire'
  if (!emptyToNull(data.projectType)) return 'Type de projet obligatoire'
  if (!emptyToNull(data.clientSiret) && !emptyToNull(data.clientEmail)) {
    return 'Ajoutez au moins un SIRET client ou un email client'
  }
  return null
}

export function buildPartnerSubmissionDraft(input: PartnerSubmissionInput):
  | {
      readonly ok: true
      readonly draft: PartnerSubmissionDraft
    }
  | {
      readonly ok: false
      readonly error: string
    } {
  const parsed = partnerSubmissionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Demande partenaire invalide',
    }
  }

  const dealError = validateDealFields(parsed.data)
  if (dealError) return { ok: false, error: dealError }

  const now = parsed.data.now ? new Date(parsed.data.now) : new Date()
  const createdAt = now.toISOString()
  const partnerKind = parsed.data.partnerKind as PartnerKind
  const contactEmail = normalizeEmail(parsed.data.contactEmail)

  const application: PartnerApplicationInsertPayload = {
    status: 'new',
    partner_kind: partnerKind,
    company_name: parsed.data.companyName.trim(),
    contact_name: parsed.data.contactName.trim(),
    contact_email: contactEmail,
    contact_phone: parsed.data.contactPhone.trim(),
    siret: emptyToNull(parsed.data.siret),
    website: emptyToNull(parsed.data.website),
    territory: emptyToNull(parsed.data.territory),
    network_description: emptyToNull(parsed.data.networkDescription),
    expected_monthly_volume: emptyToNull(parsed.data.expectedMonthlyVolume),
    message: emptyToNull(parsed.data.message),
    activity_profile: emptyToNull(parsed.data.activityProfile),
    target_status: parsed.data.targetStatus ?? null,
    utm_source: emptyToNull(parsed.data.utmSource),
    utm_medium: emptyToNull(parsed.data.utmMedium),
    utm_campaign: emptyToNull(parsed.data.utmCampaign),
    partner_ref: emptyToNull(parsed.data.partnerRef),
    source:
      parsed.data.mode === 'deal' ? 'partners_deal_form' : 'partners_page',
    created_at: createdAt,
    updated_at: createdAt,
  }

  const protectionDays = parsed.data.protectionDays ?? 120
  const deal: PartnerDealInsertPayload | null =
    parsed.data.mode === 'deal'
      ? {
          status: 'submitted',
          partner_company_name: application.company_name,
          partner_contact_email: contactEmail,
          client_company_name: emptyToNull(parsed.data.clientCompanyName) ?? '',
          client_siret: emptyToNull(parsed.data.clientSiret),
          client_email: emptyToNull(parsed.data.clientEmail),
          project_city: emptyToNull(parsed.data.projectCity),
          project_type: emptyToNull(parsed.data.projectType) ?? '',
          expected_budget_ht: parsed.data.expectedBudgetHt ?? null,
          expected_purchase_window: emptyToNull(
            parsed.data.expectedPurchaseWindow,
          ),
          product_interest: emptyToNull(parsed.data.productInterest),
          protection_days: protectionDays,
          protected_until: null,
          message: emptyToNull(parsed.data.message),
          source: 'partners_deal_form',
          created_at: createdAt,
          updated_at: createdAt,
        }
      : null

  return {
    ok: true,
    draft: {
      localId: createLocalId({
        mode: parsed.data.mode,
        companyName: parsed.data.companyName,
        now,
      }),
      mode: parsed.data.mode,
      application,
      deal,
      createdAt,
    },
  }
}

export function readLocalPartnerSubmissions(
  storage: PartnerSubmissionStorage,
): ReadonlyArray<PartnerSubmissionDraft> {
  const raw = storage.getItem(LOCAL_PARTNER_SUBMISSIONS_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPartnerSubmissionDraft)
  } catch {
    return []
  }
}

export function savePartnerSubmissionToLocalHistory({
  storage,
  draft,
}: {
  readonly storage: PartnerSubmissionStorage
  readonly draft: PartnerSubmissionDraft
}): PartnerSubmissionDraft {
  const previous = readLocalPartnerSubmissions(storage).filter(
    (item) => item.localId !== draft.localId,
  )

  storage.setItem(
    LOCAL_PARTNER_SUBMISSIONS_KEY,
    JSON.stringify([draft, ...previous].slice(0, 50)),
  )

  return draft
}
