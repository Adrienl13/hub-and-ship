import { FileText, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

const QUALITY_BUCKET = 'quality-reports'
const MAX_PDF_BYTES = 10 * 1024 * 1024 // 10 MB — keep in sync with bucket file_size_limit

interface EditableState {
  organization: QualityReportOrganization
  reportType: QualityReportType
  referenceNumber: string
  issuedAt: string
  title: string
  summary: string
  filePath: string
  fileSizeBytes: number | null
  fileMime: string | null
  previewImageUrl: string
  containerId: string // '' = none
  productCategories: ProductCategory[]
  highlights: QualityHighlight[]
}

function slugifyReference(ref: string): string {
  return (
    ref
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'report'
  )
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
    fileSizeBytes: detail.fileSizeBytes ?? null,
    fileMime: detail.fileMime ?? null,
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
    file_size_bytes: state.filePath.trim() ? state.fileSizeBytes : null,
    file_mime: state.filePath.trim() ? state.fileMime : null,
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

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

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0]
    // Reset the input so re-selecting the same file still fires onChange.
    if (event.target) event.target.value = ''
    if (!file) return
    setUploadError(null)

    if (file.type !== 'application/pdf') {
      setUploadError('Format invalide. Seul un PDF est accepté.')
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      setUploadError(
        `Fichier trop volumineux (${formatBytes(file.size)} > 10 MB).`,
      )
      return
    }
    if (!state.referenceNumber.trim()) {
      setUploadError(
        "Renseigne le numéro de référence avant d'uploader le PDF.",
      )
      return
    }

    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setUploadError('Supabase non configuré localement.')
      return
    }

    setUploading(true)
    const client = createSupabaseBrowserClient(config)
    const path = `reports/${state.organization}/${slugifyReference(state.referenceNumber)}_${Date.now()}.pdf`
    const previousPath = state.filePath
    const { error: uploadErr } = await client.storage
      .from(QUALITY_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: 'application/pdf',
      })

    if (uploadErr) {
      setUploadError(uploadErr.message)
      setUploading(false)
      return
    }

    // Best-effort cleanup of the previous file (admin RLS will allow it).
    if (previousPath && previousPath !== path) {
      await client.storage.from(QUALITY_BUCKET).remove([previousPath])
    }

    setState((prev) => ({
      ...prev,
      filePath: path,
      fileSizeBytes: file.size,
      fileMime: 'application/pdf',
    }))
    setUploading(false)
  }

  async function handleRemoveFile(): Promise<void> {
    if (!state.filePath) return
    setUploadError(null)
    const config = getSupabasePublicConfig()
    if (config.isConfigured) {
      const client = createSupabaseBrowserClient(config)
      await client.storage.from(QUALITY_BUCKET).remove([state.filePath])
    }
    setState((prev) => ({
      ...prev,
      filePath: '',
      fileSizeBytes: null,
      fileMime: null,
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
          <Field label="URL image preview (publique)">
            <Input
              value={state.previewImageUrl}
              onChange={(e) => setField('previewImageUrl', e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Fichier PDF du rapport (privé · 10 MB max)">
            {state.filePath ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-xs">
                  <FileText className="text-foreground/60 h-4 w-4 shrink-0" />
                  <span className="text-foreground/80 flex-1 truncate font-mono">
                    {state.filePath}
                  </span>
                  {state.fileSizeBytes != null && (
                    <span className="text-foreground/55 shrink-0 tabular-nums">
                      {formatBytes(state.fileSizeBytes)}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemoveFile()}
                    disabled={uploading || saving}
                    className="h-7 gap-1 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Remplacement…' : 'Remplacer'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || saving || !state.referenceNumber.trim()}
                className="h-11 w-full justify-center gap-2 border-dashed"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Upload en cours…' : 'Choisir un PDF'}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            {uploadError && (
              <p className="mt-1 text-[11px] text-red-700">{uploadError}</p>
            )}
            {!state.filePath && !state.referenceNumber.trim() && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Renseigne d'abord le numéro de référence — il sert au nommage du
                fichier dans le bucket.
              </p>
            )}
          </Field>
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
