import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  listVariantsForProduct,
  type CatalogueAdminClient,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminProduct,
  AdminProductVariant,
} from '@/lib/catalogue-admin/types'
import {
  upsertStockLine,
  type AdminStockLineRow,
  type StockAdminClient,
} from '@/lib/stock-admin/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { StockCondition } from '@/lib/supabase/types'

const CONDITION_OPTIONS: ReadonlyArray<{
  readonly value: StockCondition
  readonly label: string
}> = [
  { value: 'new', label: 'Neuf' },
  { value: 'opened_box', label: 'Carton ouvert' },
  { value: 'showroom', label: 'Exposition' },
]

interface EditableStockLine {
  id: string
  product_id: string
  variant_id: string
  available_units: string
  reserved_units: string
  stock_price_ht: string
  location: string
  ready_label: string
  condition: StockCondition
  priority: string
  note: string
  is_active: boolean
}

function fromRow(row: AdminStockLineRow): EditableStockLine {
  return {
    id: row.id,
    product_id: row.productId,
    variant_id: row.variantId,
    available_units: String(row.availableUnits),
    reserved_units: String(row.reservedUnits),
    stock_price_ht: row.stockPriceHt.toString(),
    location: row.location,
    ready_label: row.readyLabel,
    condition: row.condition,
    priority: String(row.priority),
    note: row.note,
    is_active: row.isActive,
  }
}

function empty(): EditableStockLine {
  return {
    id: '',
    product_id: '',
    variant_id: '',
    available_units: '0',
    reserved_units: '0',
    stock_price_ht: '0',
    location: 'Marseille-Fos',
    ready_label: 'Retrait sous 24h',
    condition: 'new',
    priority: '100',
    note: '',
    is_active: true,
  }
}

function parseNumber(value: string, fallback = 0): number {
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : fallback
}

function deriveStockId(productId: string, variantId: string): string {
  const a = productId.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const b = variantId.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `stock-${a}-${b}`.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export interface AdminStockEditorProps {
  readonly line: AdminStockLineRow | null
  readonly products: ReadonlyArray<AdminProduct>
  readonly onSaved: () => void | Promise<void>
  readonly onCancel: () => void
}

export function AdminStockEditor({
  line,
  products,
  onSaved,
  onCancel,
}: AdminStockEditorProps) {
  const isCreating = line === null
  const [state, setState] = useState<EditableStockLine>(() =>
    line ? fromRow(line) : empty(),
  )
  const [variants, setVariants] = useState<ReadonlyArray<AdminProductVariant>>(
    [],
  )
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const auth = useAuth()
  const config = useMemo(() => getSupabasePublicConfig(), [])

  // Load the variants for the selected product whenever it changes —
  // we can't trust the embedded variants because the catalogue cache
  // might be stale or filtered.
  useEffect(() => {
    if (!state.product_id || !config.isConfigured) {
      setVariants([])
      return
    }
    let cancelled = false
    setVariantsLoading(true)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    void listVariantsForProduct(client, state.product_id)
      .then((list) => {
        if (cancelled) return
        setVariants(list)
        setVariantsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setVariantsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [state.product_id, config])

  function setField<K extends keyof EditableStockLine>(
    key: K,
    value: EditableStockLine[K],
  ): void {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!state.product_id || !state.variant_id) {
      setError('Sélectionnez un produit et un design.')
      return
    }
    if (!state.location.trim()) {
      setError('Le lieu est requis.')
      return
    }
    setSaving(true)
    setError(null)
    if (!config.isConfigured) {
      setError('Supabase non configuré.')
      setSaving(false)
      return
    }
    const client = createSupabaseBrowserClient(config) as StockAdminClient

    const targetId = isCreating
      ? state.id.trim() || deriveStockId(state.product_id, state.variant_id)
      : state.id

    try {
      await upsertStockLine(client, {
        id: targetId,
        product_id: state.product_id,
        variant_id: state.variant_id,
        available_units: Math.max(
          0,
          Math.round(parseNumber(state.available_units)),
        ),
        reserved_units: Math.max(
          0,
          Math.round(parseNumber(state.reserved_units)),
        ),
        stock_price_ht: Math.max(0, parseNumber(state.stock_price_ht)),
        location: state.location.trim(),
        ready_label: state.ready_label.trim() || 'Retrait sous 24h',
        condition: state.condition,
        priority: Math.round(parseNumber(state.priority, 100)),
        note: state.note.trim(),
        is_active: state.is_active,
      })
      await logAdminAction(client, auth.user?.id ?? null, {
        action: isCreating ? 'stock_line.create' : 'stock_line.update',
        target: targetId,
      })
      setSaving(false)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <Fieldset title="Référence stock">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Produit">
            <select
              value={state.product_id}
              onChange={(e) => {
                setField('product_id', e.target.value)
                setField('variant_id', '')
              }}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              required
            >
              <option value="">— Sélectionner —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Design">
            <select
              value={state.variant_id}
              onChange={(e) => setField('variant_id', e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              required
              disabled={!state.product_id || variantsLoading}
            >
              <option value="">
                {variantsLoading ? 'Chargement…' : '— Sélectionner —'}
              </option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          {isCreating && (
            <Field label="ID stock (généré si vide)">
              <Input
                value={state.id}
                placeholder="stock-…"
                onChange={(e) => setField('id', e.target.value)}
              />
            </Field>
          )}
          <Field label="Priorité (tri sur la page publique)">
            <Input
              type="number"
              value={state.priority}
              onChange={(e) => setField('priority', e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Disponibilité">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Unités disponibles">
            <Input
              type="number"
              min={0}
              value={state.available_units}
              onChange={(e) => setField('available_units', e.target.value)}
            />
          </Field>
          <Field label="Unités réservées">
            <Input
              type="number"
              min={0}
              value={state.reserved_units}
              onChange={(e) => setField('reserved_units', e.target.value)}
            />
          </Field>
          <Field label="Prix HT (€)">
            <Input
              type="number"
              step="0.01"
              min={0}
              value={state.stock_price_ht}
              onChange={(e) => setField('stock_price_ht', e.target.value)}
            />
          </Field>
          <Field label="État du lot">
            <select
              value={state.condition}
              onChange={(e) =>
                setField('condition', e.target.value as StockCondition)
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {CONDITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lieu de retrait">
            <Input
              value={state.location}
              onChange={(e) => setField('location', e.target.value)}
              required
            />
          </Field>
          <Field label="Label disponibilité">
            <Input
              value={state.ready_label}
              onChange={(e) => setField('ready_label', e.target.value)}
              placeholder="Retrait sous 24h"
            />
          </Field>
          <Field label="Actif (visible sur /stock-24h)">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              <span>{state.is_active ? 'Visible' : 'Masqué'}</span>
            </label>
          </Field>
        </div>
        <Field label="Note publique (commentaire affiché sous la ligne)">
          <Textarea
            rows={2}
            value={state.note}
            onChange={(e) => setField('note', e.target.value)}
          />
        </Field>
      </Fieldset>

      <div className="flex justify-end gap-2 border-t border-[color:var(--sand-deep)] pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}

function Fieldset({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-4">
      <legend className="label-eyebrow text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
