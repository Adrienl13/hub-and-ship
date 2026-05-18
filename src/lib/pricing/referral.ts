export interface ReferralProgramConfig {
  readonly referrerCredit: number
  readonly referredDiscount: number
  readonly creditValidityMonths: number
  readonly maxUsesPerCode: number
}

export interface ReferralCodePublic {
  readonly code: string
  readonly referrerName: string
  readonly referrerCompany: string
  readonly isActive: boolean
  readonly totalUses: number
  readonly maxUses: number
  readonly expiresAt?: string
  readonly referrerSiret?: string
  readonly referrerEmails?: ReadonlyArray<string>
}

export type ReferralApplicationStatus =
  | 'none'
  | 'applied'
  | 'unknown'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'self_referral'
  | 'not_applicable'

export interface ReferralApplication {
  readonly status: ReferralApplicationStatus
  readonly code: string
  readonly referrerLabel?: string
  readonly discountAmount: number
  readonly payNow: number
  readonly message: string
}

export interface ApplyReferralCodeInput {
  readonly codeInput: string
  readonly reservationFee: number
  readonly codes: ReadonlyArray<ReferralCodePublic>
  readonly config?: ReferralProgramConfig
  readonly now?: Date
  readonly referredSiret?: string
  readonly referredEmail?: string
}

export const DEFAULT_REFERRAL_PROGRAM_CONFIG: ReferralProgramConfig = {
  referrerCredit: 200,
  referredDiscount: 100,
  creditValidityMonths: 12,
  maxUsesPerCode: 10,
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function cleanSiretForReferral(value: string | undefined): string {
  return value?.replace(/\s/g, '') ?? ''
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function isExpired(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt) return false

  const timestamp = Date.parse(expiresAt)
  if (!Number.isFinite(timestamp)) return false

  return timestamp < now.getTime()
}

export function normalizeReferralCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
}

export function applyReferralCode({
  codeInput,
  reservationFee,
  codes,
  config = DEFAULT_REFERRAL_PROGRAM_CONFIG,
  now = new Date(),
  referredSiret,
  referredEmail,
}: ApplyReferralCodeInput): ReferralApplication {
  const code = normalizeReferralCode(codeInput)
  const safeReservationFee = Math.max(0, round2(reservationFee))

  if (!code) {
    return {
      status: 'none',
      code,
      discountAmount: 0,
      payNow: safeReservationFee,
      message: 'Aucun code parrainage applique.',
    }
  }

  const referralCode = codes.find(
    (item) => normalizeReferralCode(item.code) === code,
  )

  if (!referralCode) {
    return {
      status: 'unknown',
      code,
      discountAmount: 0,
      payNow: safeReservationFee,
      message: 'Code parrainage introuvable.',
    }
  }

  const referrerLabel = `${referralCode.referrerName} - ${referralCode.referrerCompany}`

  if (!referralCode.isActive) {
    return {
      status: 'inactive',
      code,
      referrerLabel,
      discountAmount: 0,
      payNow: safeReservationFee,
      message: 'Ce code parrainage est desactive.',
    }
  }

  if (referralCode.totalUses >= referralCode.maxUses) {
    return {
      status: 'exhausted',
      code,
      referrerLabel,
      discountAmount: 0,
      payNow: safeReservationFee,
      message: 'Ce code a atteint sa limite d utilisations.',
    }
  }

  if (isExpired(referralCode.expiresAt, now)) {
    return {
      status: 'expired',
      code,
      referrerLabel,
      discountAmount: 0,
      payNow: safeReservationFee,
      message: 'Ce code parrainage a expire.',
    }
  }

  const referredSiretClean = cleanSiretForReferral(referredSiret)
  const referrerSiretClean = cleanSiretForReferral(referralCode.referrerSiret)
  const referredEmailClean = normalizeEmail(referredEmail)
  const referrerEmails = referralCode.referrerEmails?.map(normalizeEmail) ?? []

  if (
    (referredSiretClean && referredSiretClean === referrerSiretClean) ||
    (referredEmailClean && referrerEmails.includes(referredEmailClean))
  ) {
    return {
      status: 'self_referral',
      code,
      referrerLabel,
      discountAmount: 0,
      payNow: safeReservationFee,
      message:
        'Le parrainage ne peut pas etre utilise par la societe parraine.',
    }
  }

  if (safeReservationFee <= 0) {
    return {
      status: 'not_applicable',
      code,
      referrerLabel,
      discountAmount: 0,
      payNow: 0,
      message: 'Ajoutez une commande pour appliquer le parrainage.',
    }
  }

  const discountAmount = Math.min(config.referredDiscount, safeReservationFee)

  return {
    status: 'applied',
    code,
    referrerLabel,
    discountAmount,
    payNow: round2(safeReservationFee - discountAmount),
    message: `${referralCode.referrerName} vous parraine : remise appliquee sur les frais de reservation.`,
  }
}
