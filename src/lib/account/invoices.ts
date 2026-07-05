// Reservation invoices access. Issuance is admin-only and atomic via the
// `issue_reservation_invoice` RPC (continuous numbering, immutable snapshot).
// Clients read only their own invoices (RLS-scoped); admins read all.

export type InvoiceStatus = 'issued' | 'cancelled'

export interface InvoiceContactSnapshot {
  readonly name?: string
  readonly company?: string
  readonly email?: string
  readonly phone?: string
}

export interface InvoiceSnapshot {
  readonly reference?: string
  readonly container_reference?: string
  readonly siret?: string
  readonly contact?: InvoiceContactSnapshot
  readonly subtotal_ht?: number
  readonly eco_contribution_total?: number
}

export interface Invoice {
  readonly id: string
  readonly reservationId: string
  readonly number: string
  readonly status: InvoiceStatus
  readonly currency: string
  readonly subtotalHt: number
  readonly vatRate: number
  readonly vatAmount: number
  readonly totalTtc: number
  readonly issuedAt: string
  readonly snapshot: InvoiceSnapshot
}

interface Result<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

interface InvoiceRow {
  readonly id: string
  readonly reservation_id: string
  readonly number: string
  readonly status: InvoiceStatus
  readonly currency: string
  readonly subtotal_ht: number | string
  readonly vat_rate: number | string
  readonly vat_amount: number | string
  readonly total_ttc: number | string
  readonly issued_at: string
  readonly snapshot: InvoiceSnapshot | null
}

export interface InvoicesClient {
  rpc: (
    fn: 'issue_reservation_invoice',
    args: { readonly p_reservation_id: string },
  ) => PromiseLike<Result<InvoiceRow>>
  from: (table: 'invoices') => {
    select: (columns: string) => {
      eq: (
        column: 'reservation_id',
        value: string,
      ) => {
        order: (
          column: 'issued_at',
          options: { readonly ascending: boolean },
        ) => PromiseLike<Result<ReadonlyArray<InvoiceRow>>>
      }
    }
  }
}

export function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    number: row.number,
    status: row.status,
    currency: row.currency,
    subtotalHt: Number(row.subtotal_ht),
    vatRate: Number(row.vat_rate),
    vatAmount: Number(row.vat_amount),
    totalTtc: Number(row.total_ttc),
    issuedAt: row.issued_at,
    snapshot: row.snapshot ?? {},
  }
}

export async function listInvoicesForReservation(
  client: InvoicesClient,
  reservationId: string,
): Promise<ReadonlyArray<Invoice>> {
  const { data, error } = await client
    .from('invoices')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('issued_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toInvoice)
}

export async function issueInvoice(
  client: InvoicesClient,
  reservationId: string,
): Promise<Invoice> {
  const { data, error } = await client.rpc('issue_reservation_invoice', {
    p_reservation_id: reservationId,
  })
  if (error || !data) {
    throw new Error(error?.message ?? 'Émission de facture impossible')
  }
  return toInvoice(data)
}
