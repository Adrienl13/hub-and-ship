// Server-side commission accrual. Triggered at full payment — for now the admin
// "encaissement complet" action (there is no automatic Stripe balance flow yet;
// when one lands, call this from the payment_intent.succeeded webhook handler).
//
// Idempotent: the unique (reservation_id, phase) constraint + upsert with
// ignoreDuplicates guarantee a reservation is accrued at most once. Uses the
// service-role client so the base amount and referral link cannot be tampered
// with from the browser.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  matchPartnerCodeId,
  resolveReservationAccrual,
  type AccrualSkipReason,
} from '@/lib/commission/accrual'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { ReservationStatus } from '@/lib/supabase/types'

const inputSchema = z.object({
  reservationId: z.string().uuid(),
})

export type AccrueCommissionResult =
  | { readonly ok: true; readonly accrued: true; readonly amount: number }
  | {
      readonly ok: true
      readonly accrued: false
      readonly reason: AccrualSkipReason | 'not_found' | 'already_accrued'
    }
  | { readonly ok: false; readonly error: string }

export const accrueReservationCommission = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<AccrueCommissionResult> => {
    const supabase = getSupabaseAdmin()

    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .select('id, company_id, total_ht, partner_ref, status, created_at')
      .eq('id', data.reservationId)
      .maybeSingle()

    if (resErr) return { ok: false, error: resErr.message }
    if (!reservation) return { ok: true, accrued: false, reason: 'not_found' }

    // Resolve the referring partner from the reservation's first-touch code.
    // Case-insensitive: partner_ref is captured from `?ref=` un-normalized, so
    // `?ref=dbp-13` must still match the code `DBP-13` — otherwise commissions
    // would silently never accrue. partner_codes is tiny, so match in JS.
    let partnerCodeId: string | null = null
    if (reservation.partner_ref) {
      const { data: codes } = await supabase
        .from('partner_codes')
        .select('id, code')
        .eq('active', true)
      partnerCodeId = matchPartnerCodeId(codes ?? [], reservation.partner_ref)
    }

    // First-touch lock: stamp the client's referral once, never overwrite.
    let companyReferredAt: string | null = null
    if (reservation.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('referred_at, referred_by_partner_id')
        .eq('id', reservation.company_id)
        .maybeSingle()
      companyReferredAt = company?.referred_at ?? null

      if (partnerCodeId && company && company.referred_at === null) {
        await supabase
          .from('companies')
          .update({
            referred_by_partner_id: partnerCodeId,
            referred_at: reservation.created_at,
          } as never)
          .eq('id', reservation.company_id)
          .is('referred_at', null)
        companyReferredAt = reservation.created_at
      }
    }

    const decision = resolveReservationAccrual({
      reservationId: reservation.id,
      status: reservation.status as ReservationStatus,
      baseAmountHt: Number(reservation.total_ht),
      partnerCodeId,
      reservationAt: reservation.created_at,
      companyReferredAt,
    })

    if (!decision.accrued) {
      return { ok: true, accrued: false, reason: decision.reason }
    }

    // Idempotent insert: unique (reservation_id, phase) — ignore a re-run.
    const { error: insErr } = await supabase
      .from('commission_ledger')
      .upsert([decision.payload] as never, {
        onConflict: 'reservation_id,phase',
        ignoreDuplicates: true,
      })

    if (insErr) return { ok: false, error: insErr.message }
    return { ok: true, accrued: true, amount: decision.payload.amount }
  })
