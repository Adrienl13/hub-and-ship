// Persistent co-branded partner selections.
//
// A partner curates catalogue products + quantities into a selection and shares
// it as `/p/{slug}?selection={id}`. Only PUBLIC catalogue data is stored in the
// item snapshot (public price HT, eco, image) so a final client never sees net
// partner pricing. RLS (20260607180000_partner_selections.sql) scopes writes to
// the owning partner and exposes published selections to anonymous readers.

import type { Product, DesignVariant } from '@/lib/products'

export type PartnerSelectionStatus = 'draft' | 'published' | 'archived'

export interface SelectionItemSnapshot {
  readonly name: string
  readonly category: string
  readonly sku: string
  readonly imageUrl: string
  readonly basePriceHt: number
  readonly ecoContribution: number
}

export interface SelectionItemInput {
  readonly productId: string
  readonly variantId: string | null
  readonly variantName: string | null
  readonly quantity: number
  readonly snapshot: SelectionItemSnapshot
}

export interface PartnerSelectionItem extends SelectionItemInput {
  readonly id: string
  readonly position: number
}

export interface PartnerSelectionSummary {
  readonly id: string
  readonly title: string
  readonly comment: string | null
  readonly status: PartnerSelectionStatus
  readonly itemCount: number
  readonly updatedAt: string
}

export interface PartnerSelectionDetail {
  readonly id: string
  readonly title: string
  readonly comment: string | null
  readonly status: PartnerSelectionStatus
  readonly items: ReadonlyArray<PartnerSelectionItem>
}

export interface PublicSelection {
  readonly id: string
  readonly title: string
  readonly comment: string | null
  readonly items: ReadonlyArray<PartnerSelectionItem>
}

// ---------------------------------------------------------------------------
// Pure helpers (unit tested) — snapshot building and public totals.
// ---------------------------------------------------------------------------

export function buildSelectionItemInput(
  product: Product,
  variant: DesignVariant | null,
  quantity: number,
): SelectionItemInput {
  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    quantity: Math.max(1, Math.round(quantity)),
    snapshot: {
      name: product.name,
      category: product.category,
      sku: product.sku,
      imageUrl: variant?.imageUrl ?? product.mainImageUrl,
      basePriceHt: product.basePriceHt,
      ecoContribution: product.ecoContribution,
    },
  }
}

/** Public price total (direct pro price). Never reflects net partner pricing. */
export function selectionPublicTotalHt(
  items: ReadonlyArray<{ readonly quantity: number; readonly snapshot: SelectionItemSnapshot }>,
): number {
  return items.reduce(
    (sum, item) => sum + item.snapshot.basePriceHt * item.quantity,
    0,
  )
}

export function selectionTotalUnits(
  items: ReadonlyArray<{ readonly quantity: number }>,
): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface SelectionRow {
  readonly id: string
  readonly title: string
  readonly comment: string | null
  readonly status: PartnerSelectionStatus
  readonly updated_at: string
}

interface SelectionItemRow {
  readonly id: string
  readonly selection_id: string
  readonly product_id: string
  readonly variant_id: string | null
  readonly variant_name: string | null
  readonly quantity: number
  readonly position: number
  readonly product_snapshot: SelectionItemSnapshot
}

function toItem(row: SelectionItemRow): PartnerSelectionItem {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    variantName: row.variant_name,
    quantity: row.quantity,
    position: row.position,
    snapshot: row.product_snapshot,
  }
}

// ---------------------------------------------------------------------------
// Client interfaces — narrow + mockable, cast from the supabase browser client.
// ---------------------------------------------------------------------------

interface Result<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

export interface PartnerSelectionsClient {
  from: (
    table: 'partner_selections' | 'partner_selection_items',
  ) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (
          column: string,
          options: { readonly ascending: boolean },
        ) => PromiseLike<Result<ReadonlyArray<Record<string, unknown>>>>
        maybeSingle: () => PromiseLike<Result<Record<string, unknown>>>
      }
      in: (
        column: string,
        values: ReadonlyArray<string>,
      ) => PromiseLike<Result<ReadonlyArray<Record<string, unknown>>>>
      order: (
        column: string,
        options: { readonly ascending: boolean },
      ) => PromiseLike<Result<ReadonlyArray<Record<string, unknown>>>>
    }
    insert: (payload: unknown) => {
      select: (columns: string) => {
        single: () => PromiseLike<Result<{ readonly id: string }>>
      }
    } & PromiseLike<Result<null>>
    update: (payload: unknown) => {
      eq: (column: string, value: string) => PromiseLike<Result<null>>
    }
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<Result<null>>
    }
  }
}

export interface CreateSelectionInput {
  readonly applicationId: string
  readonly title: string
  readonly comment: string | null
  readonly items: ReadonlyArray<SelectionItemInput>
}

function itemInsertRows(
  selectionId: string,
  items: ReadonlyArray<SelectionItemInput>,
) {
  return items.map((item, index) => ({
    selection_id: selectionId,
    product_id: item.productId,
    variant_id: item.variantId,
    variant_name: item.variantName,
    quantity: item.quantity,
    position: index,
    product_snapshot: item.snapshot,
  }))
}

export async function listMySelections(
  client: PartnerSelectionsClient,
): Promise<ReadonlyArray<PartnerSelectionSummary>> {
  const selectionsResult = await client
    .from('partner_selections')
    .select('id, title, comment, status, updated_at')
    .order('updated_at', { ascending: false })
  if (selectionsResult.error) throw new Error(selectionsResult.error.message)
  const selections = (selectionsResult.data ?? []) as unknown as SelectionRow[]
  if (selections.length === 0) return []

  const itemsResult = await client
    .from('partner_selection_items')
    .select('selection_id')
    .in(
      'selection_id',
      selections.map((s) => s.id),
    )
  if (itemsResult.error) throw new Error(itemsResult.error.message)
  const counts = new Map<string, number>()
  for (const row of (itemsResult.data ?? []) as Array<{
    selection_id: string
  }>) {
    counts.set(row.selection_id, (counts.get(row.selection_id) ?? 0) + 1)
  }

  return selections.map((row) => ({
    id: row.id,
    title: row.title,
    comment: row.comment,
    status: row.status,
    itemCount: counts.get(row.id) ?? 0,
    updatedAt: row.updated_at,
  }))
}

async function loadSelectionWithItems(
  client: PartnerSelectionsClient,
  id: string,
  selectColumns: string,
): Promise<{ row: SelectionRow; items: PartnerSelectionItem[] } | null> {
  const selectionResult = await client
    .from('partner_selections')
    .select(selectColumns)
    .eq('id', id)
    .maybeSingle()
  if (selectionResult.error) throw new Error(selectionResult.error.message)
  if (!selectionResult.data) return null
  const row = selectionResult.data as unknown as SelectionRow

  const itemsResult = await client
    .from('partner_selection_items')
    .select('*')
    .eq('selection_id', id)
    .order('position', { ascending: true })
  if (itemsResult.error) throw new Error(itemsResult.error.message)
  const items = ((itemsResult.data ?? []) as unknown as SelectionItemRow[]).map(
    toItem,
  )
  return { row, items }
}

export async function getSelectionDetail(
  client: PartnerSelectionsClient,
  id: string,
): Promise<PartnerSelectionDetail | null> {
  const loaded = await loadSelectionWithItems(
    client,
    id,
    'id, title, comment, status, updated_at',
  )
  if (!loaded) return null
  return {
    id: loaded.row.id,
    title: loaded.row.title,
    comment: loaded.row.comment,
    status: loaded.row.status,
    items: loaded.items,
  }
}

export async function getPublicSelection(
  client: PartnerSelectionsClient,
  id: string,
): Promise<PublicSelection | null> {
  const loaded = await loadSelectionWithItems(
    client,
    id,
    'id, title, comment, status, updated_at',
  )
  // RLS only returns published rows to anon, but guard defensively.
  if (!loaded || loaded.row.status !== 'published') return null
  return {
    id: loaded.row.id,
    title: loaded.row.title,
    comment: loaded.row.comment,
    items: loaded.items,
  }
}

export async function createSelection(
  client: PartnerSelectionsClient,
  input: CreateSelectionInput,
): Promise<string> {
  const created = await client
    .from('partner_selections')
    .insert({
      partner_application_id: input.applicationId,
      title: input.title,
      comment: input.comment,
      status: 'draft',
    })
    .select('id')
    .single()
  if (created.error || !created.data) {
    throw new Error(created.error?.message ?? 'Selection insert failed')
  }
  const id = created.data.id

  if (input.items.length > 0) {
    const inserted = await client
      .from('partner_selection_items')
      .insert(itemInsertRows(id, input.items))
    if (inserted.error) throw new Error(inserted.error.message)
  }
  return id
}

export async function updateSelectionMeta(
  client: PartnerSelectionsClient,
  id: string,
  meta: { readonly title: string; readonly comment: string | null },
): Promise<void> {
  const { error } = await client
    .from('partner_selections')
    .update({ title: meta.title, comment: meta.comment })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setSelectionStatus(
  client: PartnerSelectionsClient,
  id: string,
  status: PartnerSelectionStatus,
): Promise<void> {
  const { error } = await client
    .from('partner_selections')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function replaceSelectionItems(
  client: PartnerSelectionsClient,
  id: string,
  items: ReadonlyArray<SelectionItemInput>,
): Promise<void> {
  const deleted = await client
    .from('partner_selection_items')
    .delete()
    .eq('selection_id', id)
  if (deleted.error) throw new Error(deleted.error.message)

  if (items.length > 0) {
    const inserted = await client
      .from('partner_selection_items')
      .insert(itemInsertRows(id, items))
    if (inserted.error) throw new Error(inserted.error.message)
  }
}

export async function deleteSelection(
  client: PartnerSelectionsClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('partner_selections')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
