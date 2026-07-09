import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ImageGalleryUploader, ImageUploader } from '@/components/ImageUploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Database, FireRatingDb, Json } from '@/lib/supabase/types'
import type { ProductCategory } from '@/lib/products'
import {
  getActivePricingParameters,
  getProductWithVariants,
  listCommitmentsForProduct,
  type CatalogueAdminClient,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminContainerOption,
  AdminPricingParameters,
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
type ProductUpdate = Database['public']['Tables']['products']['Update']
type ProductEditorPayload = ProductUpdate & {
  readonly partner_net_price_ht: number | null
}

type EditableVariant = AdminProductVariant & { readonly _new?: boolean }

interface EditableProduct {
  sku: string
  name: string
  description: string
  category: ProductCategory
  moq_units: string
  base_price_ht: string
  fob_usd: string
  qty_per_container: string
  is_loss_leader: boolean
  table_price_modifier_rate: string
  partner_net_price_ht: string
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
    fob_usd: detail.fobUsd?.toString() ?? '',
    qty_per_container: detail.qtyPerContainer?.toString() ?? '',
    is_loss_leader: detail.isLossLeader,
    table_price_modifier_rate:
      detail.tablePriceModifierRate === null
        ? ''
        : (detail.tablePriceModifierRate * 100).toString(),
    partner_net_price_ht: detail.partnerNetPriceHt?.toString() ?? '',
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
    fob_usd: '',
    qty_per_container: '',
    is_loss_leader: false,
    table_price_modifier_rate: '',
    partner_net_price_ht: '',
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

function toOptionalPositivePrice(value: string): number | null {
  if (!value.trim()) return null
  const parsed = parseNumber(value)
  return parsed > 0 ? parsed : null
}

function toOptionalPositiveNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = parseNumber(value)
  return parsed > 0 ? parsed : null
}

function toOptionalPositiveInt(value: string): number | null {
  const parsed = toOptionalPositiveNumber(value)
  return parsed === null ? null : Math.max(1, Math.round(parsed))
}

function toOptionalRateFromPercent(value: string): number | null {
  if (!value.trim()) return null
  return parseNumber(value) / 100
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

type PricingPreviewRow = {
  readonly label: string
  readonly quantity: number
  readonly channel: 'direct' | 'reseller' | 'distributor'
  readonly landedCostHt: number
  readonly formulaPriceHt: number
  readonly unitPriceHt: number
  readonly tierApplied: string
  readonly deltaVsCurrent: number
}

function buildPricingPreviewRows(
  state: EditableProduct,
  params: AdminPricingParameters,
): ReadonlyArray<PricingPreviewRow> {
  const basePrice = Math.max(0, parseNumber(state.base_price_ht))
  const fobUsd = toOptionalPositiveNumber(state.fob_usd)
  const qtyPerContainer = toOptionalPositiveInt(state.qty_per_container)
  const hasRealCost = fobUsd !== null && qtyPerContainer !== null
  const landedCostHt = hasRealCost
    ? round2(
        fobUsd * params.fxUsdEur * (1 + params.customsRate + params.importInsuranceRate) +
          params.freightEur40hc / qtyPerContainer +
          params.fixedImportFeeEur,
      )
    : round2(basePrice / (1 + params.directMarginRate))
  const floor = round2(landedCostHt * (1 + params.minMarginFloor))
  const isLossLeader = state.is_loss_leader

  const rows: Array<{
    label: string
    channel: 'direct' | 'reseller' | 'distributor'
    quantity: number
  }> = [
    { label: 'Direct', channel: 'direct', quantity: 1 },
    { label: `Direct palier ${params.tier2Qty}`, channel: 'direct', quantity: params.tier2Qty },
    { label: `Direct palier ${params.tier3Qty}`, channel: 'direct', quantity: params.tier3Qty },
    { label: 'Revendeur', channel: 'reseller', quantity: 1 },
    { label: 'Distributeur', channel: 'distributor', quantity: 1 },
  ]

  return rows.map((row) => {
    let rawPrice = landedCostHt * (1 + params.directMarginRate)
    let tierApplied = 'none'

    if (row.channel === 'reseller') {
      rawPrice = landedCostHt * (1 + params.resellerMarginRate)
    } else if (row.channel === 'distributor') {
      rawPrice = landedCostHt * (1 + params.distributorMarginRate)
    } else if (isLossLeader && row.quantity >= params.lossLeaderMinLot) {
      rawPrice = floor
      tierApplied = 'loss_leader'
    } else if (row.quantity >= params.tier3Qty) {
      rawPrice *= 1 - params.tier3Discount
      tierApplied = 'tier3'
    } else if (row.quantity >= params.tier2Qty) {
      rawPrice *= 1 - params.tier2Discount
      tierApplied = 'tier2'
    }

    const formulaPriceHt = Math.max(round2(rawPrice), floor)
    return {
      ...row,
      landedCostHt,
      formulaPriceHt,
      unitPriceHt: formulaPriceHt,
      tierApplied,
      deltaVsCurrent: round2(formulaPriceHt - basePrice),
    }
  })
}

function toUpdatePayload(state: EditableProduct): ProductEditorPayload {
  return {
    sku: state.sku.trim(),
    name: state.name.trim(),
    description: state.description.trim(),
    category: state.category,
    moq_units: Math.max(1, Math.round(parseNumber(state.moq_units, 1))),
    base_price_ht: Math.max(0, parseNumber(state.base_price_ht)),
    fob_usd: toOptionalPositiveNumber(state.fob_usd),
    qty_per_container: toOptionalPositiveInt(state.qty_per_container),
    is_loss_leader: state.is_loss_leader,
    table_price_modifier_rate: toOptionalRateFromPercent(
      state.table_price_modifier_rate,
    ),
    partner_net_price_ht: toOptionalPositivePrice(state.partner_net_price_ht),
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
  readonly onSaved: () => void | Promise<void>
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
  const [pricingParameters, setPricingParameters] =
    useState<AdminPricingParameters | null>(null)
  const [loading, setLoading] = useState(!isCreating)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const directPrice = state ? Math.max(0, parseNumber(state.base_price_ht)) : 0
  const partnerPrice = state
    ? toOptionalPositivePrice(state.partner_net_price_ht)
    : null
  const partnerMargin =
    partnerPrice && directPrice > 0
      ? Math.max(0, directPrice - partnerPrice)
      : null
  const cbmPerUnit = state ? Math.max(0, parseNumber(state.cbm_per_unit)) : 0
  const qtyPerContainer = state
    ? toOptionalPositiveInt(state.qty_per_container)
    : null
  const indicativeQtyPerContainer =
    cbmPerUnit > 0 ? Math.round(76 / cbmPerUnit) : null
  const qtyDeltaRatio =
    qtyPerContainer && indicativeQtyPerContainer
      ? Math.abs(qtyPerContainer - indicativeQtyPerContainer) /
        Math.max(qtyPerContainer, 1)
      : null
  const qtyNeedsReview = qtyDeltaRatio !== null && qtyDeltaRatio > 0.15
  const pricingPreviewRows =
    state && pricingParameters
      ? buildPricingPreviewRows(state, pricingParameters)
      : []
  const pricingUsesFallback =
    state !== null &&
    (!toOptionalPositiveNumber(state.fob_usd) ||
      !toOptionalPositiveInt(state.qty_per_container))

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
        const [productDetail, commitmentRows, pricing] = await Promise.all([
          getProductWithVariants(client, productId!),
          listCommitmentsForProduct(client, productId!),
          getActivePricingParameters(client),
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
        setPricingParameters(pricing)
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

  useEffect(() => {
    if (!isCreating || !config.isConfigured) return
    let cancelled = false
    async function loadPricing() {
      const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
      try {
        const pricing = await getActivePricingParameters(client)
        if (!cancelled) setPricingParameters(pricing)
      } catch {
        if (!cancelled) setPricingParameters(null)
      }
    }
    void loadPricing()
    return () => {
      cancelled = true
    }
  }, [config, isCreating])

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
    const targetProductId = isCreating ? deriveProductId(state.sku) : productId!
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
    // Only keep commitments tied to a design that is actually being saved.
    // Designs that were removed (CASCADE-deleted by the RPC) or left unnamed
    // (filtered out of variantsPayload) must NOT carry commitments, otherwise
    // the RPC re-inserts a commitment referencing a now-deleted variant_id and
    // the whole save fails on the FK — silently, mid-screen.
    const savedVariantIds = new Set(variantsPayload.map((v) => v.id))
    const commitmentsPayload = commitments
      .filter((c) => savedVariantIds.has(c.variantId))
      .map((c) => ({
        container_id: c.containerId,
        variant_id: c.variantId,
        units_committed: Math.max(0, Math.round(c.unitsCommitted)),
      }))

    // One transactional RPC instead of N sequential writes — avoids the
    // partial-failure window where the product was saved but its variants
    // (or commitments) were not.
    const { error: rpcError } = await client.rpc('admin_save_product_full', {
      payload: {
        id: targetProductId,
        create: isCreating,
        product: productPayload as unknown as Json,
        variants: variantsPayload as unknown as Json,
        removed_variant_ids: removedVariantIds,
        commitments: commitmentsPayload as unknown as Json,
      } as unknown as Json,
    } as never)

    if (rpcError) {
      setError(rpcError.message)
      // The error banner sits at the top of a long form; surface a toast too
      // so a save failure is visible even when scrolled to Designs/commitments.
      toast.error(`Échec de l'enregistrement : ${rpcError.message}`)
      setSaving(false)
      return
    }

    setSaving(false)
    toast.success('Produit enregistré.')
    await onSaved()
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
          <Field label="Conformité CE">
            <label className="flex min-h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(state.fire_rating)}
                onChange={(e) =>
                  setField('fire_rating', e.target.checked ? 'M2' : '')
                }
              />
              <span>Produit conforme CE pour usage extérieur</span>
            </label>
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
          <Field label="Prix net partenaire (€)">
            <Input
              type="number"
              step="0.01"
              placeholder="Privé, réservé aux partenaires"
              value={state.partner_net_price_ht}
              onChange={(e) =>
                setField('partner_net_price_ht', e.target.value)
              }
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
        <p className="text-xs leading-5 text-muted-foreground">
          Le prix HT base alimente le catalogue public et les réservations
          directes. Le prix net partenaire est stocké séparément derrière RLS et
          n&apos;est jamais exposé aux visiteurs anonymes.
          {partnerMargin !== null && (
            <>
              {' '}
              Marge indicative au prix public :{' '}
              <span className="font-medium text-foreground">
                {partnerMargin.toFixed(2)} €
              </span>
              .
            </>
          )}
        </p>
      </Fieldset>

      <Fieldset title="Moteur pricing">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="FOB USD / unité">
            <Input
              type="number"
              step="0.0001"
              placeholder="Coût usine HT en USD"
              value={state.fob_usd}
              onChange={(e) => setField('fob_usd', e.target.value)}
            />
          </Field>
          <Field label="Quantité réelle / 40HC">
            <Input
              type="number"
              min={1}
              placeholder="Saisie manuelle, source de vérité"
              value={state.qty_per_container}
              onChange={(e) => setField('qty_per_container', e.target.value)}
            />
          </Field>
          <Field label="Modificateur table (%)">
            <Input
              type="number"
              step="0.01"
              placeholder="ex. -8 ou 18"
              value={state.table_price_modifier_rate}
              onChange={(e) =>
                setField('table_price_modifier_rate', e.target.value)
              }
            />
          </Field>
          <Field label="Loss leader">
            <label className="flex min-h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input
                type="checkbox"
                checked={state.is_loss_leader}
                onChange={(e) =>
                  setField('is_loss_leader', e.target.checked)
                }
              />
              <span>Activer pour une référence stratégique</span>
            </label>
          </Field>
        </div>
        <div
          className={`rounded-md border px-3 py-2 text-xs leading-5 ${
            qtyNeedsReview
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : 'border-[color:var(--sand-deep)] bg-card text-muted-foreground'
          }`}
        >
          <div>
            Quantité indicative d&apos;après CBM 40HC utile :{' '}
            <span className="font-medium text-foreground">
              {indicativeQtyPerContainer ?? '—'}
            </span>
            {qtyPerContainer ? (
              <>
                {' '}
                · Quantité saisie :{' '}
                <span className="font-medium text-foreground">
                  {qtyPerContainer}
                </span>
              </>
            ) : null}
          </div>
          {qtyNeedsReview ? (
            <div className="mt-1 font-medium">
              Écart supérieur à 15% : vérifier la valeur réelle de la quote
              sheet avant d&apos;utiliser ce produit dans le moteur.
            </div>
          ) : (
            <div className="mt-1">
              La quantité saisie reste toujours prioritaire. Le CBM sert
              uniquement d&apos;alerte.
            </div>
          )}
        </div>
        {pricingPreviewRows.length > 0 && (
          <PricingPreviewTable
            rows={pricingPreviewRows}
            usesFallback={pricingUsesFallback}
          />
        )}
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

function formatSignedEuro(value: number): string {
  if (Math.abs(value) < 0.005) return '0.00 €'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} €`
}

function formatPricingRule(tierApplied: string): string {
  if (tierApplied === 'tier2') return 'Remise 100+'
  if (tierApplied === 'tier3') return 'Remise 150+'
  if (tierApplied === 'loss_leader') return 'Prix stratégique'
  return 'Prix standard'
}

function PricingPreviewTable({
  rows,
  usesFallback,
}: {
  readonly rows: ReadonlyArray<PricingPreviewRow>
  readonly usesFallback: boolean
}) {
  const direct = rows[0]

  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Prévisualisation calculée
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Coût rendu estimé :{' '}
            <span className="font-medium text-foreground">
              {direct ? `${direct.landedCostHt.toFixed(2)} €` : '—'}
            </span>
          </div>
        </div>
        {usesFallback && (
          <span className="rounded-sm bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900">
            Fallback prix actuel
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1.2fr_70px_95px_95px_95px] border-b border-[color:var(--sand-deep)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>Canal</span>
        <span className="text-right">Qté</span>
        <span className="text-right">Prix</span>
        <span className="text-right">Écart</span>
        <span className="text-right">Règle</span>
      </div>
      {rows.map((row) => (
        <div
          key={`${row.channel}-${row.quantity}`}
          className="grid grid-cols-[1.2fr_70px_95px_95px_95px] px-3 py-2 text-xs odd:bg-[color:var(--sand-soft)]/40"
        >
          <span className="font-medium">{row.label}</span>
          <span className="text-right tabular-nums">{row.quantity}</span>
          <span className="text-right font-medium tabular-nums">
            {row.unitPriceHt.toFixed(2)} €
          </span>
          <span
            className={`text-right tabular-nums ${
              row.deltaVsCurrent > 0
                ? 'text-amber-800'
                : row.deltaVsCurrent < 0
                  ? 'text-[color:var(--forest)]'
                  : 'text-muted-foreground'
            }`}
          >
            {formatSignedEuro(row.deltaVsCurrent)}
          </span>
          <span className="text-right text-muted-foreground">
            {formatPricingRule(row.tierApplied)}
          </span>
        </div>
      ))}
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
