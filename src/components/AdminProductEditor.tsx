import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  ImageGalleryUploader,
  ImageUploader,
} from '@/components/ImageUploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Database, FireRatingDb, Json } from '@/lib/supabase/types'
import type { ProductCategory } from '@/lib/products'
import {
  getProductWithVariants,
  listCommitmentsForProduct,
  type CatalogueAdminClient,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminContainerOption,
  AdminProductDetail,
  AdminProductVariant,
  AdminSeedCommitment,
} from '@/lib/catalogue-admin/types'

const CATEGORY_VALUES: ReadonlyArray<ProductCategory> = [
  'chair',
  'armchair',
  'table',
  'bench',
]
const FIRE_RATING_VALUES: ReadonlyArray<FireRatingDb> = ['M1', 'M2']

type ProductUpdate = Database['public']['Tables']['products']['Update']

type EditableVariant = AdminProductVariant & { readonly _new?: boolean }

interface EditableProduct {
  sku: string
  name: string
  description: string
  category: ProductCategory
  moq_units: string
  base_price_ht: string
  retail_price_ref: string
  eco_contribution: string
  dim_length_cm: string
  dim_width_cm: string
  dim_height_cm: string
  cbm_per_unit: string
  weight_kg: string
  fire_rating: '' | FireRatingDb
  main_image_url: string
  gallery_urls: string[]
  features: string[]
  is_active: boolean
  sort_order: string
}

function toEditable(detail: AdminProductDetail): EditableProduct {
  return {
    sku: detail.sku,
    name: detail.name,
    description: detail.description,
    category: detail.category,
    moq_units: String(detail.moqUnits),
    base_price_ht: detail.basePriceHt.toString(),
    retail_price_ref: detail.retailPriceRef.toString(),
    eco_contribution: detail.ecoContribution.toString(),
    dim_length_cm: String(detail.dimensions.l),
    dim_width_cm: String(detail.dimensions.w),
    dim_height_cm: String(detail.dimensions.h),
    cbm_per_unit: detail.cbmPerUnit.toString(),
    weight_kg: detail.weightKg.toString(),
    fire_rating: detail.fireRating ?? '',
    main_image_url: detail.mainImageUrl,
    gallery_urls: [...detail.galleryUrls],
    features: [...detail.features],
    is_active: detail.isActive,
    sort_order: String(detail.sortOrder),
  }
}

function emptyEditable(): EditableProduct {
  return {
    sku: '',
    name: '',
    description: '',
    category: 'chair',
    moq_units: '50',
    base_price_ht: '0',
    retail_price_ref: '0',
    eco_contribution: '0',
    dim_length_cm: '0',
    dim_width_cm: '0',
    dim_height_cm: '0',
    cbm_per_unit: '0.05',
    weight_kg: '0',
    fire_rating: '',
    main_image_url: '',
    gallery_urls: [],
    features: [],
    is_active: true,
    sort_order: '0',
  }
}

// Derive a stable text id from the SKU (`CHA-CAN-001` → `cha-can-001`). The
// `products.id` column is `text`, not uuid, so a slugged SKU keeps it
// predictable and human-readable.
function deriveProductId(sku: string): string {
  return sku
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseNumber(value: string, fallback = 0): number {
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : fallback
}

function toUpdatePayload(state: EditableProduct): ProductUpdate {
  return {
    sku: state.sku.trim(),
    name: state.name.trim(),
    description: state.description.trim(),
    category: state.category,
    moq_units: Math.max(1, Math.round(parseNumber(state.moq_units, 1))),
    base_price_ht: Math.max(0, parseNumber(state.base_price_ht)),
    retail_price_ref: Math.max(0, parseNumber(state.retail_price_ref)),
    eco_contribution: Math.max(0, parseNumber(state.eco_contribution)),
    dim_length_cm: Math.max(0, Math.round(parseNumber(state.dim_length_cm))),
    dim_width_cm: Math.max(0, Math.round(parseNumber(state.dim_width_cm))),
    dim_height_cm: Math.max(0, Math.round(parseNumber(state.dim_height_cm))),
    cbm_per_unit: Math.max(0.0001, parseNumber(state.cbm_per_unit, 0.01)),
    weight_kg: Math.max(0, parseNumber(state.weight_kg)),
    fire_rating: state.fire_rating === '' ? null : state.fire_rating,
    main_image_url: state.main_image_url.trim(),
    gallery_urls: state.gallery_urls.filter((u) => u.trim()),
    features: state.features.filter((f) => f.trim()),
    is_active: state.is_active,
    sort_order: Math.round(parseNumber(state.sort_order)),
  }
}

function buildVariantId(productId: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${productId}-v-${suffix}`
}

export interface AdminProductEditorProps {
  /** Existing product id to edit, or `null` to create a new product. */
  readonly productId: string | null
  readonly containers: ReadonlyArray<AdminContainerOption>
  readonly onSaved: (productId?: string) => void | Promise<void>
  readonly onCancel: () => void
}

export function AdminProductEditor({
  productId,
  containers,
  onSaved,
  onCancel,
}: AdminProductEditorProps) {
  const isCreating = productId === null
  const [detail, setDetail] = useState<AdminProductDetail | null>(null)
  const [state, setState] = useState<EditableProduct | null>(
    isCreating ? emptyEditable() : null,
  )
  const [variants, setVariants] = useState<EditableVariant[]>([])
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([])
  const [commitments, setCommitments] = useState<AdminSeedCommitment[]>([])
  const [loading, setLoading] = useState(!isCreating)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = useMemo(() => getSupabasePublicConfig(), [])

  useEffect(() => {
    if (isCreating) return
    let cancelled = false
    async function load() {
      if (!config.isConfigured) {
        setError('Supabase non configuré.')
        setLoading(false)
        return
      }
      const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
      try {
        const [productDetail, commitmentRows] = await Promise.all([
          getProductWithVariants(client, productId!),
          listCommitmentsForProduct(client, productId!),
        ])
        if (cancelled) return
        if (!productDetail) {
          setError('Produit introuvable.')
          setLoading(false)
          return
        }
        setDetail(productDetail)
        setState(toEditable(productDetail))
        setVariants(productDetail.variants.map((v) => ({ ...v })))
        setCommitments([...commitmentRows])
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [config, productId, isCreating])

  function setField<K extends keyof EditableProduct>(
    key: K,
    value: EditableProduct[K],
  ): void {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateVariant(index: number, next: EditableVariant): void {
    setVariants((prev) => {
      const list = prev.slice()
      list[index] = next
      return list
    })
  }

  function removeVariant(index: number): void {
    setVariants((prev) => {
      const list = prev.slice()
      const [removed] = list.splice(index, 1)
      if (removed && !removed._new) {
        setRemovedVariantIds((ids) => [...ids, removed.id])
      }
      return list
    })
  }

  function addVariant(): void {
    // In create mode the product id is only known after the SKU is filled
    // (we derive it at submit time). Use the SKU-derived id as a stable
    // prefix here so variant ids stay readable; fall back to "new" if the
    // SKU is still empty.
    const prefix = productId ?? (deriveProductId(state?.sku ?? '') || 'new')
    setVariants((prev) => [
      ...prev,
      {
        id: buildVariantId(prefix),
        productId: prefix,
        name: '',
        imageUrl: null,
        galleryUrls: [],
        sortOrder: prev.length,
        _new: true,
      },
    ])
  }

  function commitmentValue(containerId: string, variantId: string): number {
    return (
      commitments.find(
        (c) => c.containerId === containerId && c.variantId === variantId,
      )?.unitsCommitted ?? 0
    )
  }

  function setCommitment(
    containerId: string,
    variantId: string,
    units: number,
  ): void {
    setCommitments((prev) => {
      const idx = prev.findIndex(
        (c) => c.containerId === containerId && c.variantId === variantId,
      )
      if (idx === -1) {
        return [...prev, { containerId, variantId, unitsCommitted: units }]
      }
      const list = prev.slice()
      list[idx] = { containerId, variantId, unitsCommitted: units }
      return list
    })
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!state) return
    if (!isCreating && !detail) return
    setSaving(true)
    setError(null)
    if (!config.isConfigured) {
      setError('Supabase non configuré.')
      setSaving(false)
      return
    }
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient

    // Resolve the target product id up-front. In create mode the id is
    // derived from the SKU (stable, human-readable). In edit mode we keep
    // the existing id.
    const targetProductId = isCreating
      ? deriveProductId(state.sku)
      : productId!
    if (isCreating && !targetProductId) {
      setError('Le SKU est requis pour créer un produit.')
      setSaving(false)
      return
    }

    const productPayload = toUpdatePayload(state)
    const variantsPayload = variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        id: v.id,
        name: v.name.trim(),
        image_url: v.imageUrl?.trim() || null,
        gallery_urls: v.galleryUrls.filter((url) => url.trim()),
        sort_order: v.sortOrder,
      }))
    // Only keep commitments whose design survives this save. A removed design
    // is deleted by the RPC (cascading its commitments), so re-sending a
    // commitment for it would violate container_seed_commitments' FK and abort
    // the whole save.
    const survivingVariantIds = new Set(variantsPayload.map((v) => v.id))
    const commitmentsPayload = commitments
      .filter((c) => survivingVariantIds.has(c.variantId))
      .map((c) => ({
        container_id: c.containerId,
        variant_id: c.variantId,
        units_committed: Math.max(0, Math.round(c.unitsCommitted)),
      }))

    // Guard: a product with no design is hidden from the public catalogue
    // (db.ts filters variants.length > 0). Warn before saving such a product,
    // and if the admin confirms, force it inactive so the state is explicit
    // (never "actif mais introuvable"). A DB-side net enforces the same
    // invariant for any other caller.
    if (variantsPayload.length === 0) {
      const confirmed = window.confirm(
        "Ce produit n'a aucun design.\n\n" +
          'Un produit sans design est masqué du catalogue public. ' +
          'Voulez-vous quand même enregistrer ? Il sera automatiquement ' +
          'marqué « Inactif ».',
      )
      if (!confirmed) {
        setSaving(false)
        return
      }
      productPayload.is_active = false
    }

    // One transactional RPC instead of N sequential writes — avoids the
    // partial-failure window where the product was saved but its variants
    // (or commitments) were not.
    const { error: rpcError } = await client.rpc(
      'admin_save_product_full',
      {
        payload: {
          id: targetProductId,
          create: isCreating,
          product: productPayload as unknown as Json,
          variants: variantsPayload as unknown as Json,
          removed_variant_ids: removedVariantIds,
          commitments: commitmentsPayload as unknown as Json,
        } as unknown as Json,
      } as never,
    )

    if (rpcError) {
      setError(rpcError.message)
      // Surface it as a toast too: the inline banner sits at the top of a tall
      // scrollable form, so a user who clicked "Enregistrer" at the bottom
      // would otherwise see nothing happen.
      toast.error('Enregistrement échoué', { description: rpcError.message })
      setSaving(false)
      return
    }

    setSaving(false)
    toast.success('Produit enregistré')
    await onSaved(targetProductId)
  }

  if (loading) {
    return (
      <div className="px-4 py-8 text-sm text-muted-foreground">Chargement…</div>
    )
  }

  if (!state || (!isCreating && !detail)) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
        {error ?? 'Produit introuvable.'}
      </div>
    )
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
          <Field label="SKU (unique)">
            <Input
              value={state.sku}
              onChange={(e) => setField('sku', e.target.value)}
            />
          </Field>
          <Field label="Nom">
            <Input
              value={state.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </Field>
          <Field label="Catégorie">
            <select
              value={state.category}
              onChange={(e) =>
                setField('category', e.target.value as ProductCategory)
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Classement feu">
            <select
              value={state.fire_rating}
              onChange={(e) =>
                setField(
                  'fire_rating',
                  (e.target.value as FireRatingDb | '') || '',
                )
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">— Aucun</option>
              {FIRE_RATING_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Actif">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              <span>{state.is_active ? 'Visible catalogue' : 'Masqué'}</span>
            </label>
          </Field>
          <Field label="Ordre">
            <Input
              type="number"
              value={state.sort_order}
              onChange={(e) => setField('sort_order', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={4}
            value={state.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </Field>
      </Fieldset>

      <Fieldset title="Tarifs & MOQ">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="MOQ (unités)">
            <Input
              type="number"
              value={state.moq_units}
              onChange={(e) => setField('moq_units', e.target.value)}
            />
          </Field>
          <Field label="Prix HT base (€)">
            <Input
              type="number"
              step="0.01"
              value={state.base_price_ht}
              onChange={(e) => setField('base_price_ht', e.target.value)}
            />
          </Field>
          <Field label="Prix retail référence (€)">
            <Input
              type="number"
              step="0.01"
              value={state.retail_price_ref}
              onChange={(e) => setField('retail_price_ref', e.target.value)}
            />
          </Field>
          <Field label="Éco-contribution (€)">
            <Input
              type="number"
              step="0.01"
              value={state.eco_contribution}
              onChange={(e) => setField('eco_contribution', e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Dimensions & logistique">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="L (cm)">
            <Input
              type="number"
              value={state.dim_length_cm}
              onChange={(e) => setField('dim_length_cm', e.target.value)}
            />
          </Field>
          <Field label="l (cm)">
            <Input
              type="number"
              value={state.dim_width_cm}
              onChange={(e) => setField('dim_width_cm', e.target.value)}
            />
          </Field>
          <Field label="H (cm)">
            <Input
              type="number"
              value={state.dim_height_cm}
              onChange={(e) => setField('dim_height_cm', e.target.value)}
            />
          </Field>
          <Field label="CBM / unité (m³)">
            <Input
              type="number"
              step="0.001"
              value={state.cbm_per_unit}
              onChange={(e) => setField('cbm_per_unit', e.target.value)}
            />
          </Field>
          <Field label="Poids (kg)">
            <Input
              type="number"
              step="0.01"
              value={state.weight_kg}
              onChange={(e) => setField('weight_kg', e.target.value)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset title="Images & contenu">
        <Field label="Image principale">
          <ImageUploader
            value={state.main_image_url}
            onChange={(url) => setField('main_image_url', url)}
            folder="products"
            hint="Photo hero affichée sur la card produit et le catalogue."
          />
        </Field>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Galerie produit
          </Label>
          <ImageGalleryUploader
            values={state.gallery_urls}
            onChange={(next) => setField('gallery_urls', next)}
            folder="products"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Points forts (features)
          </Label>
          <RepeatableStringList
            values={state.features}
            onChange={(next) => setField('features', next)}
          />
        </div>
      </Fieldset>

      <Fieldset title="Designs">
        <p className="text-xs text-muted-foreground">
          Un design = une déclinaison visuelle du produit. La photo principale
          sert de vignette dans le sélecteur, la galerie alimente la visionneuse
          publique quand le client choisit ce design.
        </p>
        <div className="space-y-4">
          {variants.map((variant, i) => (
            <div
              key={variant.id}
              className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3"
            >
              <div className="grid gap-2 md:grid-cols-[1fr_100px_auto]">
                <Field label="Nom du design">
                  <Input
                    value={variant.name}
                    placeholder="ex. Rotin tressé naturel"
                    onChange={(e) =>
                      updateVariant(i, { ...variant, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Ordre">
                  <Input
                    type="number"
                    value={variant.sortOrder}
                    onChange={(e) =>
                      updateVariant(i, {
                        ...variant,
                        sortOrder: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeVariant(i)}
                    aria-label={`Supprimer le design ${variant.name || i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Field label="Photo principale (vignette du sélecteur)">
                <ImageUploader
                  value={variant.imageUrl ?? ''}
                  onChange={(url) =>
                    updateVariant(i, { ...variant, imageUrl: url || null })
                  }
                  folder="designs"
                  hint="Image affichée dans le sélecteur de design côté client."
                />
              </Field>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Galerie du design
                </Label>
                <ImageGalleryUploader
                  values={[...variant.galleryUrls]}
                  onChange={(next) =>
                    updateVariant(i, { ...variant, galleryUrls: next })
                  }
                  folder="designs"
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={addVariant}
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter un design
          </Button>
        </div>
      </Fieldset>

      {containers.length > 0 && variants.length > 0 && (
        <Fieldset title="Engagements seed par container">
          <p className="text-xs text-muted-foreground">
            Unités déjà engagées par variante × container.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-left">
                    Variante
                  </th>
                  {containers.map((container) => (
                    <th
                      key={container.id}
                      className="border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-center"
                    >
                      {container.reference}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="border border-[color:var(--sand-deep)] px-2 py-1">
                      {variant.name || variant.id}
                    </td>
                    {containers.map((container) => (
                      <td
                        key={container.id}
                        className="border border-[color:var(--sand-deep)] px-1 py-1"
                      >
                        <Input
                          type="number"
                          min={0}
                          className="h-7 text-xs"
                          value={commitmentValue(container.id, variant.id)}
                          onChange={(e) =>
                            setCommitment(
                              container.id,
                              variant.id,
                              Number(e.target.value),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fieldset>
      )}

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
