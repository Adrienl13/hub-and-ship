import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Database, Json } from '@/lib/supabase/types'
import type {
  GalleryItem,
  ProductBreakdown,
  TimelineStatus,
  TimelineStep,
} from '@/lib/delivered-containers/types'
import type { ProductCategory } from '@/lib/products'

type ContainerRow = Database['public']['Tables']['containers']['Row']
type ContainerUpdate = Database['public']['Tables']['containers']['Update']

const CATEGORY_VALUES: ReadonlyArray<ProductCategory> = [
  'chair',
  'armchair',
  'table',
  'bench',
]
const TIMELINE_STATUS_VALUES: ReadonlyArray<TimelineStatus> = ['done', 'delay']

interface EditableState {
  slug: string
  origin_port: string
  total_items: string
  professionals_served: string
  savings_total_eur: string
  savings_percent: string
  story: string
  photo_url: string
  planned_days: string
  actual_days: string
  delivered_at: string
  testimonial_quote: string
  testimonial_long_quote: string
  testimonial_author: string
  testimonial_role: string
  testimonial_location: string
  testimonial_rating: string
  certifications: string[]
  timeline: TimelineStep[]
  product_breakdown: ProductBreakdown[]
  gallery: GalleryItem[]
}

function asJsonArray<T>(value: Json | null | undefined): T[] {
  if (Array.isArray(value)) return [...(value as unknown as T[])]
  return []
}

function fromRow(row: ContainerRow): EditableState {
  return {
    slug: row.slug ?? '',
    origin_port: row.origin_port ?? '',
    total_items: row.total_items?.toString() ?? '',
    professionals_served: row.professionals_served?.toString() ?? '',
    savings_total_eur: row.savings_total_eur?.toString() ?? '',
    savings_percent: row.savings_percent?.toString() ?? '',
    story: row.story ?? '',
    photo_url: row.photo_url ?? '',
    planned_days: row.planned_days?.toString() ?? '',
    actual_days: row.actual_days?.toString() ?? '',
    delivered_at: row.delivered_at ?? '',
    testimonial_quote: row.testimonial_quote ?? '',
    testimonial_long_quote: row.testimonial_long_quote ?? '',
    testimonial_author: row.testimonial_author ?? '',
    testimonial_role: row.testimonial_role ?? '',
    testimonial_location: row.testimonial_location ?? '',
    testimonial_rating: row.testimonial_rating?.toString() ?? '',
    certifications: asJsonArray<string>(row.certifications),
    timeline: asJsonArray<TimelineStep>(row.timeline),
    product_breakdown: asJsonArray<ProductBreakdown>(row.product_breakdown),
    gallery: asJsonArray<GalleryItem>(row.gallery),
  }
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function toUpdate(state: EditableState): ContainerUpdate {
  return {
    slug: state.slug.trim() || null,
    origin_port: state.origin_port.trim() || null,
    total_items: parseNumberOrNull(state.total_items),
    professionals_served: parseNumberOrNull(state.professionals_served),
    savings_total_eur: parseNumberOrNull(state.savings_total_eur),
    savings_percent: parseNumberOrNull(state.savings_percent),
    story: state.story.trim() || null,
    photo_url: state.photo_url.trim() || null,
    planned_days: parseNumberOrNull(state.planned_days),
    actual_days: parseNumberOrNull(state.actual_days),
    delivered_at: state.delivered_at.trim() || null,
    testimonial_quote: state.testimonial_quote.trim() || null,
    testimonial_long_quote: state.testimonial_long_quote.trim() || null,
    testimonial_author: state.testimonial_author.trim() || null,
    testimonial_role: state.testimonial_role.trim() || null,
    testimonial_location: state.testimonial_location.trim() || null,
    testimonial_rating: parseNumberOrNull(state.testimonial_rating),
    certifications: state.certifications.filter((c) => c.trim()) as Json,
    timeline: state.timeline as unknown as Json,
    product_breakdown: state.product_breakdown as unknown as Json,
    gallery: state.gallery as unknown as Json,
  }
}

export interface AdminContainerEditorProps {
  readonly container: ContainerRow
  readonly onSaved: () => void | Promise<void>
  readonly onCancel: () => void
}

export function AdminContainerEditor({
  container,
  onSaved,
  onCancel,
}: AdminContainerEditorProps) {
  const [state, setState] = useState<EditableState>(() => fromRow(container))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField<K extends keyof EditableState>(
    key: K,
    value: EditableState[K],
  ): void {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setError('Supabase non configuré.')
      setSaving(false)
      return
    }
    const client = createSupabaseBrowserClient(config)
    const { error: updateError } = await client
      .from('containers')
      .update(toUpdate(state) as never)
      .eq('id', container.id)
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    await onSaved()
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <Fieldset title="Identification & métriques">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Slug (unique)">
            <Input
              value={state.slug}
              onChange={(e) => setField('slug', e.target.value)}
              placeholder="cc-2026-001"
            />
          </Field>
          <Field label="Port d'origine">
            <Input
              value={state.origin_port}
              onChange={(e) => setField('origin_port', e.target.value)}
              placeholder="Ningbo (Chine)"
            />
          </Field>
          <Field label="Date de livraison">
            <Input
              type="date"
              value={state.delivered_at}
              onChange={(e) => setField('delivered_at', e.target.value)}
            />
          </Field>
          <Field label="Photo URL (hero)">
            <Input
              value={state.photo_url}
              onChange={(e) => setField('photo_url', e.target.value)}
            />
          </Field>
          <Field label="Articles livrés">
            <Input
              type="number"
              value={state.total_items}
              onChange={(e) => setField('total_items', e.target.value)}
            />
          </Field>
          <Field label="Pros servis">
            <Input
              type="number"
              value={state.professionals_served}
              onChange={(e) => setField('professionals_served', e.target.value)}
            />
          </Field>
          <Field label="Économies totales (€)">
            <Input
              type="number"
              step="0.01"
              value={state.savings_total_eur}
              onChange={(e) => setField('savings_total_eur', e.target.value)}
            />
          </Field>
          <Field label="Économies (%)">
            <Input
              type="number"
              value={state.savings_percent}
              onChange={(e) => setField('savings_percent', e.target.value)}
            />
          </Field>
          <Field label="Jours annoncés">
            <Input
              type="number"
              value={state.planned_days}
              onChange={(e) => setField('planned_days', e.target.value)}
            />
          </Field>
          <Field label="Jours réels">
            <Input
              type="number"
              value={state.actual_days}
              onChange={(e) => setField('actual_days', e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Histoire">
        <Textarea
          rows={6}
          value={state.story}
          onChange={(e) => setField('story', e.target.value)}
        />
      </Fieldset>

      <Fieldset title="Témoignage">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Citation courte">
            <Textarea
              rows={2}
              value={state.testimonial_quote}
              onChange={(e) => setField('testimonial_quote', e.target.value)}
            />
          </Field>
          <Field label="Citation longue">
            <Textarea
              rows={2}
              value={state.testimonial_long_quote}
              onChange={(e) =>
                setField('testimonial_long_quote', e.target.value)
              }
            />
          </Field>
          <Field label="Auteur">
            <Input
              value={state.testimonial_author}
              onChange={(e) => setField('testimonial_author', e.target.value)}
            />
          </Field>
          <Field label="Rôle">
            <Input
              value={state.testimonial_role}
              onChange={(e) => setField('testimonial_role', e.target.value)}
            />
          </Field>
          <Field label="Lieu">
            <Input
              value={state.testimonial_location}
              onChange={(e) => setField('testimonial_location', e.target.value)}
            />
          </Field>
          <Field label="Note (0-5)">
            <Input
              type="number"
              min={0}
              max={5}
              value={state.testimonial_rating}
              onChange={(e) => setField('testimonial_rating', e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Certifications">
        <RepeatableStringList
          values={state.certifications}
          onChange={(next) => setField('certifications', next)}
        />
      </Fieldset>

      <Fieldset title="Timeline">
        <RepeatableList
          items={state.timeline}
          empty={(): TimelineStep => ({
            date: new Date().toISOString().slice(0, 10),
            label: '',
            description: '',
            status: 'done',
          })}
          onChange={(next) => setField('timeline', next)}
          render={(item, update) => (
            <div className="grid gap-2 md:grid-cols-[140px_1fr_120px]">
              <Input
                type="date"
                value={item.date}
                onChange={(e) => update({ ...item, date: e.target.value })}
              />
              <div className="space-y-2">
                <Input
                  value={item.label}
                  onChange={(e) => update({ ...item, label: e.target.value })}
                  placeholder="Étape"
                />
                <Textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) =>
                    update({ ...item, description: e.target.value })
                  }
                  placeholder="Description"
                />
              </div>
              <select
                value={item.status}
                onChange={(e) =>
                  update({
                    ...item,
                    status: e.target.value as TimelineStatus,
                  })
                }
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {TIMELINE_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'done' ? 'OK' : 'Retard'}
                  </option>
                ))}
              </select>
            </div>
          )}
        />
      </Fieldset>

      <Fieldset title="Produits livrés (breakdown)">
        <RepeatableList
          items={state.product_breakdown}
          empty={(): ProductBreakdown => ({
            category: 'chair',
            units: 0,
            modelLabel: '',
          })}
          onChange={(next) => setField('product_breakdown', next)}
          render={(item, update) => (
            <div className="grid gap-2 md:grid-cols-[140px_120px_1fr]">
              <select
                value={item.category}
                onChange={(e) =>
                  update({
                    ...item,
                    category: e.target.value as ProductCategory,
                  })
                }
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {CATEGORY_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                value={item.units}
                onChange={(e) =>
                  update({ ...item, units: Number(e.target.value) })
                }
              />
              <Input
                value={item.modelLabel}
                onChange={(e) =>
                  update({ ...item, modelLabel: e.target.value })
                }
                placeholder="Modèle"
              />
            </div>
          )}
        />
      </Fieldset>

      <Fieldset title="Galerie">
        <RepeatableList
          items={state.gallery}
          empty={() => ({ url: '', caption: '' })}
          onChange={(next) => setField('gallery', next)}
          render={(item, update) => (
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={item.url}
                onChange={(e) => update({ ...item, url: e.target.value })}
                placeholder="URL"
              />
              <Input
                value={item.caption}
                onChange={(e) => update({ ...item, caption: e.target.value })}
                placeholder="Légende"
              />
            </div>
          )}
        />
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

function RepeatableStringList({
  values,
  onChange,
}: {
  readonly values: ReadonlyArray<string>
  readonly onChange: (next: string[]) => void
}) {
  return (
    <div className="space-y-2">
      {values.map((value, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => {
              const next = values.slice()
              next[i] = e.target.value
              onChange(next)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...values, ''])}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter
      </Button>
    </div>
  )
}

function RepeatableList<T>({
  items,
  empty,
  onChange,
  render,
}: {
  readonly items: ReadonlyArray<T>
  readonly empty: () => T
  readonly onChange: (next: T[]) => void
  readonly render: (item: T, update: (next: T) => void) => React.ReactNode
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="space-y-2 rounded-md border border-[color:var(--sand-deep)] bg-card p-3"
        >
          {render(item, (next) => {
            const list = items.slice() as T[]
            list[i] = next
            onChange(list)
          })}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, empty()])}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter
      </Button>
    </div>
  )
}
