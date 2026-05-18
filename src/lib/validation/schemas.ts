import { z } from 'zod'

import { normalizeReferralCode } from '@/lib/pricing/referral'
import { validateSiretFormat } from './siret'

export const deliveryModeSchema = z.enum([
  'pickup_at_port',
  'self_arranged',
  'partner_carrier_needed',
])

export const callbackSubjectSchema = z.enum([
  'product_question',
  'quote_help',
  'logistics',
  'after_sales',
  'other',
])

export const callbackSlotSchema = z.enum([
  'within_hour',
  'tomorrow_morning',
  'tomorrow_afternoon',
  'custom',
])

export const siretInputSchema = z
  .string()
  .min(1, 'SIRET requis')
  .transform((value) => value.replace(/\s/g, ''))
  .superRefine((value, context) => {
    const result = validateSiretFormat(value)

    if (!result.valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.reason ?? 'SIRET invalide',
      })
    }
  })

export const businessEmailSchema = z
  .string()
  .trim()
  .email('Email invalide')
  .transform((value) => value.toLowerCase())

export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Telephone trop court')
  .max(30, 'Telephone trop long')
  .regex(/^[+()\d\s.-]+$/, 'Telephone invalide')

export const referralCodeSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? normalizeReferralCode(value) : undefined))
  .refine(
    (value) => value === undefined || /^[A-Z0-9-]{4,40}$/.test(value),
    'Code parrainage invalide',
  )

export const reservationContactSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis').max(120),
  company: z.string().trim().min(2, 'Societe requise').max(160),
  email: businessEmailSchema,
  phone: phoneSchema,
})

export const reservationDeliverySchema = z.object({
  deliveryMode: deliveryModeSchema,
  deliveryNote: z.string().trim().max(500).optional(),
})

export const reservationCheckoutSchema = z.object({
  siret: siretInputSchema,
  contact: reservationContactSchema,
  delivery: reservationDeliverySchema,
  referralCode: referralCodeSchema,
  cgvAccepted: z.literal(true, {
    errorMap: () => ({ message: 'CGV obligatoires' }),
  }),
})

export const callbackRequestSchema = z
  .object({
    siret: siretInputSchema,
    name: z.string().trim().min(2).max(120),
    company: z.string().trim().min(2).max(160),
    email: businessEmailSchema,
    phone: phoneSchema,
    slot: callbackSlotSchema,
    customSlotAt: z.string().datetime().optional(),
    subject: callbackSubjectSchema,
    message: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.slot === 'custom' && !value.customSlotAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customSlotAt'],
        message: 'Creneau personnalise requis',
      })
    }
  })

export type ReservationCheckoutInput = z.infer<typeof reservationCheckoutSchema>
export type CallbackRequestInput = z.infer<typeof callbackRequestSchema>
