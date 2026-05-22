import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  upsertCarrier,
  type AdminCarrier,
  type CarrierPartnersClient,
  type CarrierUpsertPayload,
} from '@/lib/carrier-partners/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { CarrierSpecialtyDb } from '@/lib/supabase/types'

const SPECIALTY_VALUES: ReadonlyArray<CarrierSpecialtyDb> = [
  'national',
  'regional_sud_est',
  'regional_ouest',
  'international',
  'plateforme',
]

const SOURCE_VALUES = ['partenaire-direct', 'plateforme-publique'] as const

interface EditableCarrier {
  slug: string
  name: string
  specialty: CarrierSpecialtyDb
  specialtyLabel: string
  summary: string
  strengths: string[]
  coverage: string
  indicativePricing: string
  contactPhone: string
  contactEmail: string
  contactWebsite: string
  source: 'partenaire-direct' | 'plateforme-publique'
  sortOrder: string
  isActive: boolean
}

function fromCarrier(carrier: AdminCarrier | null): EditableCarrier {
  if (!carrier) {
    return {
      slug: '',
      name: '',
      specialty: 'national',
      specialtyLabel: '',
      summary: '',
      strengths: [],
      coverage: '',
      indicativePricing: '',
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
      source: 'partenaire-direct',
      sortOrder: '0',
      isActive: true,
    }
  }
  return {
    slug: carrier.slug,
    name: carrier.name,
    specialty: carrier.specialty as CarrierSpecialtyDb,
    specialtyLabel: carrier.specialtyLabel,
    summary: carrier.summary,
    strengths: [...carrier.strengths],
    coverage: carrier.coverage,
    indicativePricing: carrier.indicativePricing,
    contactPhone: carrier.contact.phone ?? '',
    contactEmail: carrier.contact.email ?? '',
    contactWebsite: carrier.contact.website ?? '',
    source: carrier.source,
    sortOrder: String(carrier.sortOrder),
    isActive: carrier.isActive,
  }
}

function toPayload(
  state: EditableCarrier,
  id: string | undefined,
): CarrierUpsertPayload {
  return {
    id,
    slug: state.slug.trim(),
    name: state.name.trim(),
    specialty: state.specialty,
    specialtyLabel: state.specialtyLabel.trim(),
    summary: state.summary.trim(),
    strengths: state.strengths.filter((s) => s.trim()),
    coverage: state.coverage.trim(),
    indicativePricing: state.indicativePricing.trim() || null,
    contactPhone: state.contactPhone.trim() || null,
    contactEmail: state.contactEmail.trim() || null,
    contactWebsite: state.contactWebsite.trim() || null,
    source: state.source,
    sortOrder: Number.isFinite(Number(state.sortOrder))
      ? Number(state.sortOrder)
      : 0,
    isActive: state.isActive,
  }
}

export interface AdminCarrierPartnerEditorProps {
  readonly carrier: AdminCarrier | null
  readonly onSaved: () => void | Promise<void>
  readonly onCancel: () => void
}

export function AdminCarrierPartnerEditor({
  carrier,
  onSaved,
  onCancel,
}: AdminCarrierPartnerEditorProps) {
  const [state, setState] = useState<EditableCarrier>(() =>
    fromCarrier(carrier),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField<K extends keyof EditableCarrier>(
    key: K,
    value: EditableCarrier[K],
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
    if (!state.slug.trim() || !state.name.trim() || !state.summary.trim()) {
      setError('Slug, nom et résumé sont obligatoires.')
      setSaving(false)
      return
    }
    const client = createSupabaseBrowserClient(config) as CarrierPartnersClient
    try {
      await upsertCarrier(client, toPayload(state, carrier?.id))
      setSaving(false)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <Fieldset title="Identification">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Slug (unique)">
            <Input
              value={state.slug}
              onChange={(e) => setField('slug', e.target.value)}
              placeholder="geodis"
            />
          </Field>
          <Field label="Nom">
            <Input
              value={state.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </Field>
          <Field label="Spécialité">
            <select
              value={state.specialty}
              onChange={(e) =>
                setField('specialty', e.target.value as CarrierSpecialtyDb)
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {SPECIALTY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Libellé spécialité">
            <Input
              value={state.specialtyLabel}
              onChange={(e) => setField('specialtyLabel', e.target.value)}
            />
          </Field>
          <Field label="Source">
            <select
              value={state.source}
              onChange={(e) =>
                setField(
                  'source',
                  e.target.value as (typeof SOURCE_VALUES)[number],
                )
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {SOURCE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordre">
            <Input
              type="number"
              value={state.sortOrder}
              onChange={(e) => setField('sortOrder', e.target.value)}
            />
          </Field>
          <Field label="Actif">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
              />
              <span>{state.isActive ? 'Publié' : 'Masqué'}</span>
            </label>
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Description">
        <Field label="Résumé">
          <Textarea
            rows={4}
            value={state.summary}
            onChange={(e) => setField('summary', e.target.value)}
          />
        </Field>
        <Field label="Couverture">
          <Input
            value={state.coverage}
            onChange={(e) => setField('coverage', e.target.value)}
          />
        </Field>
        <Field label="Tarif indicatif">
          <Textarea
            rows={2}
            value={state.indicativePricing}
            onChange={(e) => setField('indicativePricing', e.target.value)}
          />
        </Field>
      </Fieldset>

      <Fieldset title="Points forts">
        <RepeatableStringList
          values={state.strengths}
          onChange={(next) => setField('strengths', next)}
        />
      </Fieldset>

      <Fieldset title="Contact">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Téléphone">
            <Input
              value={state.contactPhone}
              onChange={(e) => setField('contactPhone', e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={state.contactEmail}
              onChange={(e) => setField('contactEmail', e.target.value)}
            />
          </Field>
          <Field label="Site web">
            <Input
              value={state.contactWebsite}
              onChange={(e) => setField('contactWebsite', e.target.value)}
            />
          </Field>
        </div>
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
