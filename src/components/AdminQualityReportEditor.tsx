import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { QualityReportDetail } from '@/lib/quality-reports/types'
import {
  ORGANIZATION_LABEL,
  ORGANIZATIONS,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABEL,
  REPORT_TYPE_LABEL,
  REPORT_TYPES,
  type ProductCategory,
  type QualityHighlight,
  type QualityReportOrganization,
  type QualityReportType,
} from '@/lib/quality-reports/types'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Database, Json } from '@/lib/supabase/types'

type QualityReportUpdate =
  Database['public']['Tables']['quality_reports']['Update']

interface ContainerOption {
  readonly id: string
  readonly reference: string
}

export interface AdminQualityReportEditorProps {
  readonly report: QualityReportDetail
  readonly containers: ReadonlyArray<ContainerOption>
  readonly onSaved: () => void | Promise<void>
  readonly onCancel: () => void
}

interface EditableState {
  organization: QualityReportOrganization
  reportType: QualityReportType
  referenceNumber: string
  issuedAt: string
  title: string
  summary: string
  filePath: string
  previewImageUrl: string
  containerId: string // '' = none
  productCategories: ProductCategory[]
  highlights: QualityHighlight[]
}

function fromDetail(detail: QualityReportDetail): EditableState {
  return {
    organization: detail.organization,
    reportType: detail.reportType,
    referenceNumber: detail.referenceNumber,
    issuedAt: detail.issuedAt,
    title: detail.title,
    summary: detail.summary ?? '',
    filePath: detail.filePath ?? '',
    previewImageUrl: detail.previewImageUrl ?? '',
    containerId: '',
    productCategories: [...detail.productCategories],
    highlights: detail.highlights.map((h) => ({ ...h })),
  }
}

function toUpdate(
  state: EditableState,
  initialContainerId: string,
): QualityReportUpdate {
  const containerChanged = state.containerId !== initialContainerId
  return {
    organization: state.organization,
    report_type: state.reportType,
    reference_number: state.referenceNumber.trim(),
    issued_at: state.issuedAt,
    title: state.title.trim(),
    summary: state.summary.trim() || null,
    file_path: state.filePath.trim() || null,
    preview_image_url: state.previewImageUrl.trim() || null,
    product_categories: state.productCategories,
    highlights: state.highlights.filter(
      (h) => h.label.trim() && h.value.trim(),
    ) as unknown as Json,
    ...(containerChanged ? { container_id: state.containerId || null } : {}),
  }
}

export function AdminQualityReportEditor({
  report,
  containers,
  onSaved,
  onCancel,
}: AdminQualityReportEditorProps) {
  const [state, setState] = useState<EditableState>(() => fromDetail(report))
  const [initialContainerId, setInitialContainerId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // We don't carry the original container_id in QualityReportDetail (the
  // public type only joins the reference/slug). So we resolve it from the
  // currently selected container reference when the editor mounts.
  useEffect(() => {
    if (!report.containerReference) {
      setInitialContainerId('')
      setState((prev) => ({ ...prev, containerId: '' }))
      return
    }
    const match = containers.find(
      (c) => c.reference === report.containerReference,
    )
    const id = match?.id ?? ''
    setInitialContainerId(id)
    setState((prev) => ({ ...prev, containerId: id }))
  }, [report.containerReference, containers])

  function setField<K extends keyof EditableState>(
    key: K,
    value: EditableState[K],
  ): void {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  function toggleCategory(category: ProductCategory): void {
    setState((prev) => {
      const exists = prev.productCategories.includes(category)
      return {
        ...prev,
        productCategories: exists
          ? prev.productCategories.filter((c) => c !== category)
          : [...prev.productCategories, category],
      }
    })
  }

  function updateHighlight(index: number, next: QualityHighlight): void {
    setState((prev) => {
      const list = prev.highlights.slice()
      list[index] = next
      return { ...prev, highlights: list }
    })
  }

  function removeHighlight(index: number): void {
    setState((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== index),
    }))
  }

  function addHighlight(): void {
    setState((prev) => ({
      ...prev,
      highlights: [...prev.highlights, { label: '', value: '' }],
    }))
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
      .from('quality_reports')
      .update(toUpdate(state, initialContainerId) as never)
      .eq('id', report.id)
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

      <Fieldset title="Identification">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Organisme">
            <select
              value={state.organization}
              onChange={(e) =>
                setField(
                  'organization',
                  e.target.value as QualityReportOrganization,
                )
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {ORGANIZATIONS.map((org) => (
                <option key={org} value={org}>
                  {ORGANIZATION_LABEL[org]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type de rapport">
            <select
              value={state.reportType}
              onChange={(e) =>
                setField('reportType', e.target.value as QualityReportType)
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Référence (unique par organisme)">
            <Input
              value={state.referenceNumber}
              onChange={(e) => setField('referenceNumber', e.target.value)}
              placeholder="SGS-FR-2025-014-AQL"
              required
            />
          </Field>
          <Field label="Date d'émission">
            <Input
              type="date"
              value={state.issuedAt}
              onChange={(e) => setField('issuedAt', e.target.value)}
              required
            />
          </Field>
          <Field label="Container associé">
            <select
              value={state.containerId}
              onChange={(e) => setField('containerId', e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">Aucun</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Contenu public">
        <div className="space-y-3">
          <Field label="Titre">
            <Input
              value={state.title}
              onChange={(e) => setField('title', e.target.value)}
              required
            />
          </Field>
          <Field label="Résumé (paragraphe court affiché sur la card)">
            <Textarea
              rows={4}
              value={state.summary}
              onChange={(e) => setField('summary', e.target.value)}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="URL image preview (publique)">
              <Input
                value={state.previewImageUrl}
                onChange={(e) => setField('previewImageUrl', e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Chemin fichier (Supabase Storage)">
              <Input
                value={state.filePath}
                onChange={(e) => setField('filePath', e.target.value)}
                placeholder="reports/sgs/cc_2025_014_aql.pdf"
              />
            </Field>
          </div>
        </div>
      </Fieldset>

      <Fieldset title="Catégories produits couvertes">
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((cat) => {
            const active = state.productCategories.includes(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`min-h-9 rounded-sm border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]'
                    : 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground'
                }`}
              >
                {PRODUCT_CATEGORY_LABEL[cat]}
              </button>
            )
          })}
        </div>
      </Fieldset>

      <Fieldset title="Highlights (label + valeur)">
        <div className="space-y-2">
          {state.highlights.map((h, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={h.label}
                onChange={(e) =>
                  updateHighlight(i, { ...h, label: e.target.value })
                }
                placeholder="Label (ex. Articles inspectés)"
              />
              <Input
                value={h.value}
                onChange={(e) =>
                  updateHighlight(i, { ...h, value: e.target.value })
                }
                placeholder="Valeur (ex. 287/287)"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeHighlight(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addHighlight}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
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
