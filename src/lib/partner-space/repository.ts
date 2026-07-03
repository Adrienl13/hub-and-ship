// Partner-facing reads for the connected /partenaire space. RLS (LOT 6
// self-read policies) scopes every row to the signed-in partner's own company:
// they see only their partner codes and their own commission ledger.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  CommissionStatus,
  Database,
} from '@/lib/supabase/types'

export type PartnerSpaceClient = SupabaseBrowserClient

type LedgerRow = Database['public']['Tables']['commission_ledger']['Row']
type PartnerCodeRow = Database['public']['Tables']['partner_codes']['Row']

export interface MyPartnerCode {
  readonly id: string
  readonly code: string
  readonly active: boolean
}

export interface MyCommissionRow {
  readonly id: string
  readonly reservationId: string
  readonly baseAmountHt: number
  readonly amount: number
  readonly status: CommissionStatus
  readonly phase: 'accrual' | 'reversal'
  readonly accruedAt: string
  readonly paidAt: string | null
}

export interface PartnerSpaceData {
  readonly codes: ReadonlyArray<MyPartnerCode>
  readonly commissions: ReadonlyArray<MyCommissionRow>
}

export interface PartnerCommissionSummary {
  readonly reservationsAttributed: number
  readonly caEncaisseHt: number
  readonly accrued: number
  readonly payable: number
  readonly paid: number
  readonly total: number
}

export async function loadPartnerSpace(
  client: PartnerSpaceClient,
): Promise<PartnerSpaceData> {
  const { data: codesData, error: codesErr } = await client
    .from('partner_codes')
    .select('id, code, active')
    .order('created_at', { ascending: true })
  if (codesErr) throw new Error(codesErr.message)

  const { data: ledgerData, error: ledgerErr } = await client
    .from('commission_ledger')
    .select(
      'id, reservation_id, base_amount_ht, amount, status, phase, accrued_at, paid_at',
    )
    .order('accrued_at', { ascending: false })
  if (ledgerErr) throw new Error(ledgerErr.message)

  const codes = ((codesData ?? []) as ReadonlyArray<
    Pick<PartnerCodeRow, 'id' | 'code' | 'active'>
  >).map((row) => ({ id: row.id, code: row.code, active: row.active }))

  const commissions = ((ledgerData ?? []) as ReadonlyArray<LedgerRow>).map(
    (row) => ({
      id: row.id,
      reservationId: row.reservation_id,
      baseAmountHt: Number(row.base_amount_ht),
      amount: Number(row.amount),
      status: row.status,
      phase: row.phase,
      accruedAt: row.accrued_at,
      paidAt: row.paid_at,
    }),
  )

  return { codes, commissions }
}

/** Roll up a partner's own ledger into the dashboard counters. */
export function summarizePartnerCommissions(
  commissions: ReadonlyArray<MyCommissionRow>,
): PartnerCommissionSummary {
  const reservations = new Set<string>()
  let caEncaisseHt = 0
  let accrued = 0
  let payable = 0
  let paid = 0

  for (const row of commissions) {
    if (row.phase === 'accrual') reservations.add(row.reservationId)
    caEncaisseHt += row.baseAmountHt
    if (row.status === 'accrued') accrued += row.amount
    else if (row.status === 'payable') payable += row.amount
    else if (row.status === 'paid') paid += row.amount
  }

  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
  return {
    reservationsAttributed: reservations.size,
    caEncaisseHt: round2(caEncaisseHt),
    accrued: round2(accrued),
    payable: round2(payable),
    paid: round2(paid),
    total: round2(accrued + payable + paid),
  }
}
