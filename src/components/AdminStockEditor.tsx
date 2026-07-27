import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AdminProductEditor } from '@/components/AdminProductEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ImageGalleryUploader,
  ImageUploader,
} from '@/components/ImageUploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  createDefaultVariant,
  listVariantsForProduct,
  updateProduct,
  type CatalogueAdminClient,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminContainerOption,
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
  image_url: string
  image_urls: string[]
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
    image_url: row.imageUrl ?? '',
    image_urls: [...row.imageUrls],
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
    image_url: '',
    image_urls: [],
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
  readonly containers: ReadonlyArray<AdminContainerOption>
  /**
   * Pre-select this catalogue product when creating a fresh line — used by
   * the "Mettre au stock" shortcut so an existing product is dropped into
   * stock without re-creating its sheet.
   */
  readonly initialProductId?: string
  /** Reload the parent's product list (after creating a new product). */
  readonly onProductCreated: () => void | Promise<void>
  readonly onSaved: () => void | Promise<void>
  readonly onCancel: () => void
}

export function AdminStockEditor({
  line,
  products,
  containers,
  initialProductId,
  onProductCreated,
  onSaved,
  onCancel,
}: AdminStockEditorProps) {
  const isCreating = line === null
  const [state, setState] = useState<EditableStockLine>(() =>
    line ? fromRow(line) : { ...empty(), product_id: initialProductId ?? '' },
  )
  const [variants, setVariants] = useState<ReadonlyArray<AdminProductVariant>>(
    [],
  )
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [creatingVariant, setCreatingVariant] = useState(false)
  const [activatingProduct, setActivatingProduct] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productCreatorOpen, setProductCreatorOpen] = useState(false)

  const auth = useAuth()
  const config = useMemo(() => getSupabasePublicConfig(), [])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === state.product_id) ?? null,
    [products, state.product_id],
  )

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
        // Auto-sélection : un produit n'a souvent qu'un design — le
        // pré-choisir évite le blocage silencieux de la validation native
        // (« Please select an item in the list ») sur un champ resté vide.
        setState((prev) =>
          prev.variant_id && list.some((v) => v.id === prev.variant_id)
            ? prev
            : { ...prev, variant_id: list[0]?.id ?? '' },
        )
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

  // Produit sans aucun design (import massif, fiche incomplète) : au lieu
  // d'un sélecteur vide impossible à valider, on crée le design « Standard »
  // en un clic et on le sélectionne.
  async function handleCreateDefaultVariant(): Promise<void> {
    if (!state.product_id || !config.isConfigured) return
    setCreatingVariant(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      const variant = await createDefaultVariant(client, state.product_id)
      setVariants([variant])
      setField('variant_id', variant.id)
      toast.success('Design « Standard » créé pour ce produit.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(`Création du design impossible : ${message}`)
      toast.error(`Création du design impossible : ${message}`)
    }
    setCreatingVariant(false)
  }

  // Une ligne de stock sur un produit inactif est invisible sur /stock-24h
  // (la page publique résout produit + design dans le catalogue actif) —
  // on le dit et on propose la réactivation immédiate.
  async function handleActivateProduct(): Promise<void> {
    if (!state.product_id || !config.isConfigured) return
    setActivatingProduct(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      await updateProduct(client, state.product_id, { is_active: true })
      toast.success('Produit réactivé — visible au catalogue et au stock.')
      await onProductCreated()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(`Réactivation impossible : ${message}`)
      toast.error(`Réactivation impossible : ${message}`)
    }
    setActivatingProduct(false)
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!state.product_id || !state.variant_id) {
      setError(
        state.product_id && variants.length === 0
          ? 'Ce produit n’a aucun design — créez le design « Standard » ci-dessus avant d’enregistrer.'
          : 'Sélectionnez un produit et un design.',
      )
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
        image_url: state.image_url.trim() || null,
        image_urls: state.image_urls.filter((url) => url.trim()),
      })
      await logAdminAction(client, auth.user?.id ?? null, {
        action: isCreating ? 'stock_line.create' : 'stock_line.update',
        target: targetId,
      })
      setSaving(false)
      toast.success(
        isCreating ? 'Ligne de stock créée.' : 'Ligne de stock enregistrée.',
      )
      await onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      // Le bandeau d'erreur est en haut d'un long formulaire — un toast rend
      // l'échec visible même quand l'admin est scrollé plus bas.
      toast.error(`Échec de l'enregistrement : ${message}`)
      setSaving(false)
    }
  }

  return (
    <>
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
              aria-label="Produit"
              className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"
              required
            >
              <option value="">— Sélectionner —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setProductCreatorOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--ember)] hover:underline"
            >
              <Plus className="h-3 w-3" />
              Créer un nouveau produit
            </button>
          </Field>
          <Field label="Design">
            <select
              value={state.variant_id}
              onChange={(e) => setField('variant_id', e.target.value)}
              aria-label="Design"
              className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"
              required
              disabled={
                !state.product_id || variantsLoading || variants.length === 0
              }
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
            {/* Cul-de-sac historique : produit sans design → sélecteur vide
                que la validation native rendait impossible à comprendre.
                On l'explique et on débloque en un clic. */}
            {state.product_id &&
              !variantsLoading &&
              variants.length === 0 && (
                <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Ce produit n&apos;a aucun design. Un design est requis
                      pour la mise en stock et l&apos;affichage catalogue.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={creatingVariant}
                    onClick={() => void handleCreateDefaultVariant()}
                  >
                    {creatingVariant
                      ? 'Création…'
                      : 'Créer le design « Standard »'}
                  </Button>
                </div>
              )}
          </Field>
          {selectedProduct && !selectedProduct.isActive && (
            <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900 md:col-span-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Ce produit est <strong>inactif</strong> : sa ligne de stock
                  sera enregistrée mais restera invisible sur /stock-24h tant
                  que le produit n&apos;est pas réactivé.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={activatingProduct}
                onClick={() => void handleActivateProduct()}
              >
                {activatingProduct ? 'Réactivation…' : 'Réactiver le produit'}
              </Button>
            </div>
          )}
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
              className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"
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

      <Fieldset title="Photos du lot">
        <Field label="Photo principale (optionnelle — fallback sur la photo produit)">
          <ImageUploader
            value={state.image_url}
            onChange={(url) => setField('image_url', url)}
            folder="stock"
            hint="Vignette affichée dans la liste publique /stock-24h."
          />
        </Field>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Galerie additionnelle (5–6 photos max recommandé)
          </Label>
          <ImageGalleryUploader
            values={state.image_urls}
            onChange={(next) => setField('image_urls', next)}
            folder="stock"
          />
          <p className="text-[10px] text-muted-foreground">
            Affichées dans le panneau de droite à côté du formulaire de
            demande, pour rassurer l&apos;acheteur sur l&apos;état réel du lot.
          </p>
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

      {/* Shortcut: create a brand-new catalogue product without leaving the
          stock editor. On save we reload the product list and auto-select the
          freshly created product so the admin can finish the stock line. */}
      <Dialog open={productCreatorOpen} onOpenChange={setProductCreatorOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau produit catalogue</DialogTitle>
          </DialogHeader>
          {productCreatorOpen && (
            <AdminProductEditor
              productId={null}
              containers={containers}
              onSaved={async (newProductId) => {
                setProductCreatorOpen(false)
                await onProductCreated()
                if (newProductId) {
                  setField('product_id', newProductId)
                  setField('variant_id', '')
                }
              }}
              onCancel={() => setProductCreatorOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
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
    // min-w-0 : sans lui, un <select> au contenu long déborde de sa colonne
    // de grille et chevauche le champ voisin (formulaire illisible).
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
