import { z } from 'zod'

import type {
  PartnerApplicationStatus,
  PartnerTargetStatus,
} from '@/lib/supabase/types'
import { cleanSiret, validateSiretChecksum } from '@/lib/validation/siret'

export type { PartnerApplicationStatus, PartnerTargetStatus }

/** Activity profiles offered by the /partenaires selector + form. */
export const PARTNER_ACTIVITY_PROFILES = [
  'brasseur',
  'pisciniste',
  'paysagiste',
  'magasin',
  'chr',
  'agent',
  'export',
  'autre',
] as const
export type PartnerActivityProfile = (typeof PARTNER_ACTIVITY_PROFILES)[number]

export const PARTNER_ACTIVITY_PROFILE_LABEL: Record<
  PartnerActivityProfile,
  string
> = {
  brasseur: 'Distributeur boissons / brasseur',
  pisciniste: 'Pisciniste',
  paysagiste: 'Paysagiste / aménageur',
  magasin: 'Magasin / revendeur mobilier',
  chr: 'Groupe CHR · camping · hôtellerie',
  agent: 'Agent commercial / consultant',
  export: 'Importateur / distributeur étranger',
  autre: 'Autre',
}

export const PARTNER_TARGET_STATUSES: ReadonlyArray<PartnerTargetStatus> = [
  'apporteur',
  'revendeur',
  'grand_compte',
  'distributeur',
  'nsp',
]

export const PARTNER_TARGET_STATUS_LABEL: Record<PartnerTargetStatus, string> = {
  apporteur: 'AP-08 · Apporteur d’affaires',
  revendeur: 'RV-AG · Revendeur agréé',
  grand_compte: 'GC-CA · Grand compte',
  distributeur: 'DX-PAYS · Distributeur exclusif',
  nsp: 'Je ne sais pas encore — conseillez-moi',
}

export interface PartnerApplicationInput {
  readonly companyName: string
  readonly siret: string
  readonly contactName: string
  readonly email: string
  readonly phone?: string
  readonly activityProfile: string
  readonly targetStatus: string
  readonly zone?: string
  readonly estimatedVolume?: string
  readonly message?: string
  readonly now?: Date
}

export interface PartnerApplicationDraft {
  readonly companyName: string
  readonly siret: string
  readonly contactName: string
  readonly email: string
  readonly phone: string | null
  readonly activityProfile: PartnerActivityProfile
  readonly targetStatus: PartnerTargetStatus
  readonly zone: string | null
  readonly estimatedVolume: string | null
  readonly message: string | null
  readonly status: PartnerApplicationStatus
  readonly createdAt: string
}

export interface PartnerApplicationValidationIssue {
  readonly path: string
  readonly message: string
}

export type PartnerApplicationDraftResult =
  | { readonly ok: true; readonly draft: PartnerApplicationDraft }
  | {
      readonly ok: false
      readonly issues: ReadonlyArray<PartnerApplicationValidationIssue>
    }

const partnerApplicationSchema = z.object({
  companyName: z.string().trim().min(2, 'Raison sociale obligatoire'),
  siret: z
    .string()
    .trim()
    .transform((value) => cleanSiret(value))
    .refine((value) => /^\d{14}$/.test(value), {
      message: 'Le SIRET doit contenir exactement 14 chiffres',
    })
    .refine((value) => validateSiretChecksum(value), {
      message: 'Numéro SIRET invalide (clé de contrôle incorrecte)',
    }),
  contactName: z.string().trim().min(2, 'Contact obligatoire'),
  email: z.string().trim().email('Email professionnel invalide'),
  phone: z.string().trim().min(6, 'Téléphone invalide').optional().or(z.literal('')),
  activityProfile: z.enum(PARTNER_ACTIVITY_PROFILES, {
    message: 'Profil d’activité obligatoire',
  }),
  targetStatus: z.enum(['apporteur', 'revendeur', 'grand_compte', 'distributeur', 'nsp'] as const, {
    message: 'Statut visé obligatoire',
  }),
  zone: z.string().trim().max(200).optional().or(z.literal('')),
  estimatedVolume: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
})

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function buildPartnerApplicationDraft(
  input: PartnerApplicationInput,
): PartnerApplicationDraftResult {
  const parsed = partnerApplicationSchema.safeParse({
    companyName: input.companyName,
    siret: input.siret,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    activityProfile: input.activityProfile,
    targetStatus: input.targetStatus,
    zone: input.zone,
    estimatedVolume: input.estimatedVolume,
    message: input.message,
  })

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'partnerApplication',
        message: issue.message,
      })),
    }
  }

  const now = input.now ?? new Date()

  return {
    ok: true,
    draft: {
      companyName: parsed.data.companyName,
      siret: parsed.data.siret,
      contactName: parsed.data.contactName,
      email: parsed.data.email.toLocaleLowerCase('fr-FR'),
      phone: emptyToNull(parsed.data.phone),
      activityProfile: parsed.data.activityProfile,
      targetStatus: parsed.data.targetStatus,
      zone: emptyToNull(parsed.data.zone),
      estimatedVolume: emptyToNull(parsed.data.estimatedVolume),
      message: emptyToNull(parsed.data.message),
      status: 'new',
      createdAt: now.toISOString(),
    },
  }
}

/**
 * Statut visé (page mockup) → partner_kind (pipeline codex). Le statut visé
 * reste stocké tel quel dans `target_status`; le kind alimente le tri du
 * pipeline candidatures existant.
 */
export const TARGET_STATUS_TO_PARTNER_KIND: Record<
  PartnerTargetStatus,
  'introducer' | 'reseller' | 'network' | 'other'
> = {
  apporteur: 'introducer',
  revendeur: 'reseller',
  distributeur: 'network',
  grand_compte: 'other',
  nsp: 'other',
}

/**
 * Map the validated mockup draft onto the /api/partner-requests payload
 * (server-side intake: service-role insert + Brevo notifications). SIRET INSEE
 * verification stays deferred to admin — format/checksum already validated.
 */
export function toPartnerRequestApiPayload(
  draft: PartnerApplicationDraft,
  attribution?: {
    readonly utm_source: string | null
    readonly utm_medium: string | null
    readonly utm_campaign: string | null
    readonly partner_ref: string | null
  },
): Record<string, unknown> {
  return {
    mode: 'application',
    partnerKind: TARGET_STATUS_TO_PARTNER_KIND[draft.targetStatus],
    companyName: draft.companyName,
    contactName: draft.contactName,
    contactEmail: draft.email,
    contactPhone: draft.phone ?? '',
    siret: draft.siret,
    territory: draft.zone,
    expectedMonthlyVolume: draft.estimatedVolume,
    message: draft.message,
    activityProfile: draft.activityProfile,
    targetStatus: draft.targetStatus,
    utmSource: attribution?.utm_source ?? null,
    utmMedium: attribution?.utm_medium ?? null,
    utmCampaign: attribution?.utm_campaign ?? null,
    partnerRef: attribution?.partner_ref ?? null,
  }
}
