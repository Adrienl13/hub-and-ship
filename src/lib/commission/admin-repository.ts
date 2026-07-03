// Admin-grade commission ledger repository. Lists entries joined (in JS) to
// their partner code + referring company, and marks entries payable/paid.
// RLS "Admins manage commission ledger" restricts these to admin/super_admin.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  CommissionPhase,
  CommissionStatus,
  Database,
} from '@/lib/supabase/types'

export type CommissionAdminClient = SupabaseBrowserClient

type LedgerRow = Database['public']['Tables']['commission_ledger']['Row']
type PartnerCodeRow = Database['public']['Tables']['partner_codes']['Row']
type CompanyRow = Database['public']['Tables']['companies']['Row']

export interface CommissionAdminRow {
  readonly id: string
  readonly partnerCodeId: string
  readonly partnerCode: string
  readonly companyName: string
  readonly reservationId: string
  readonly baseAmountHt: number
  readonly rate: number
  readonly amount: number
  readonly status: CommissionStatus
  readonly phase: CommissionPhase
  readonly accruedAt: string
  readonly paidAt: string | null
}

export interface CommissionPartnerSummary {
  readonly partnerCodeId: string
  readonly partnerCode: string
  readonly companyName: string
  readonly accrued: number
  readonly payable: number
  readonly paid: number
}

export async function listAllCommissions(
  client: CommissionAdminClient,
): Promise<ReadonlyArray<CommissionAdminRow>> {
  const { data: ledger, error } = await client
    .from('commission_ledger')
    .select('*')
    .order('accrued_at', { ascending: false })
  if (error) throw new Error(error.message)

  const rows = (ledger ?? []) as ReadonlyArray<LedgerRow>
  if (rows.length === 0) return []

  const { data: codes } = await client
    .from('partner_codes')
    .select('id, code, company_id')
  const codeById = new Map(
    ((codes ?? []) as ReadonlyArray<PartnerCodeRow>).map((c) => [c.id, c]),
  )

  const companyIds = [
    ...new Set(
      [...codeById.values()].map((c) => c.company_id).filter(Boolean),
    ),
  ]
  const companyById = new Map<string, string>()
  if (companyIds.length > 0) {
    const { data: companies } = await client
      .from('companies')
      .select('id, legal_name')
      .in('id', companyIds)
    for (const company of (companies ?? []) as ReadonlyArray<
      Pick<CompanyRow, 'id' | 'legal_name'>
    >) {
      companyById.set(company.id, company.legal_name)
    }
  }

  return rows.map((row) => {
    const code = codeById.get(row.partner_code_id)
    return {
      id: row.id,
      partnerCodeId: row.partner_code_id,
      partnerCode: code?.code ?? '—',
      companyName: code ? (companyById.get(code.company_id) ?? '—') : '—',
      reservationId: row.reservation_id,
      baseAmountHt: Number(row.base_amount_ht),
      rate: Number(row.rate),
      amount: Number(row.amount),
      status: row.status,
      phase: row.phase,
      accruedAt: row.accrued_at,
      paidAt: row.paid_at,
    }
  })
}

/** Roll up entries per apporteur into accrued / payable / paid totals. */
export function summarizeByPartner(
  rows: ReadonlyArray<CommissionAdminRow>,
): ReadonlyArray<CommissionPartnerSummary> {
  const byPartner = new Map<string, CommissionPartnerSummary>()
  for (const row of rows) {
    const current = byPartner.get(row.partnerCodeId) ?? {
      partnerCodeId: row.partnerCodeId,
      partnerCode: row.partnerCode,
      companyName: row.companyName,
      accrued: 0,
      payable: 0,
      paid: 0,
    }
    byPartner.set(row.partnerCodeId, {
      ...current,
      accrued: current.accrued + (row.status === 'accrued' ? row.amount : 0),
      payable: current.payable + (row.status === 'payable' ? row.amount : 0),
      paid: current.paid + (row.status === 'paid' ? row.amount : 0),
    })
  }
  return [...byPartner.values()].sort((a, b) =>
    a.companyName.localeCompare(b.companyName),
  )
}

export async function setCommissionsStatus(
  client: CommissionAdminClient,
  ids: ReadonlyArray<string>,
  status: CommissionStatus,
): Promise<void> {
  if (ids.length === 0) return
  const payload =
    status === 'paid'
      ? { status, paid_at: new Date().toISOString() }
      : { status, paid_at: null }
  const { error } = await client
    .from('commission_ledger')
    .update(payload as never)
    .in('id', [...ids])
  if (error) throw new Error(error.message)
}

/** Build a CSV of the ledger rows (monthly export). */
export function commissionsToCsv(
  rows: ReadonlyArray<CommissionAdminRow>,
): string {
  const header = [
    'apporteur_code',
    'societe',
    'reservation_id',
    'base_ht',
    'taux',
    'montant',
    'statut',
    'phase',
    'accrued_at',
    'paid_at',
  ]
  const escape = (value: string): string =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const lines = rows.map((row) =>
    [
      row.partnerCode,
      row.companyName,
      row.reservationId,
      row.baseAmountHt.toFixed(2),
      row.rate.toFixed(2),
      row.amount.toFixed(2),
      row.status,
      row.phase,
      row.accruedAt,
      row.paidAt ?? '',
    ]
      .map((cell) => escape(String(cell)))
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
