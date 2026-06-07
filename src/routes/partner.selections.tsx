import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { PartnerGuard } from '@/components/PartnerGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCatalog } from '@/hooks/useCatalog'
import {
  loadPartnerWorkspace,
  type PartnerPortalClient,
} from '@/lib/partners/portal'
import {
  buildSelectionItemInput,
  createSelection,
  deleteSelection,
  getSelectionDetail,
  listMySelections,
  replaceSelectionItems,
  selectionPublicTotalHt,
  selectionTotalUnits,
  setSelectionStatus,
  updateSelectionMeta,
  type PartnerSelectionsClient,
  type PartnerSelectionSummary,
  type SelectionItemInput,
} from '@/lib/partners/selections'
import { buildPartnerSharePath } from '@/lib/partners/link'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import { formatEUR } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export const Route = createFileRoute('/partner/selections')({
  component: PartnerSelectionsRoute,
  head: () =>
    buildSeoHead({
      title: 'Sélections co-brandées',
      description:
        'Créez et partagez des sélections produits co-brandées Pros Import.',
      path: '/partner/selections',
      noindex: true,
    }),
})

function PartnerSelectionsRoute() {
  return (
    <PartnerGuard>
      <SelectionsManager />
    </PartnerGuard>
  )
}

interface AppContext {
  readonly id: string
  readonly slug: string | null
  readonly companyName: string
}

interface DraftState {
  readonly id: string | null
  readonly title: string
  readonly comment: string
  readonly quantities: ReadonlyMap<string, number>
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  title: '',
  comment: '',
  quantities: new Map(),
}

function SelectionsManager() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const { products } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])

  const [appContext, setAppContext] = useState<AppContext | null>(null)
  const [selections, setSelections] = useState<
    ReadonlyArray<PartnerSelectionSummary>
  >([])
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  )
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [busy, setBusy] = useState(false)

  const selectionsClient = useMemo(
    () =>
      createSupabaseBrowserClient(
        config,
      ) as unknown as PartnerSelectionsClient,
    [config],
  )

  async function refresh(): Promise<void> {
    try {
      const portalClient = createSupabaseBrowserClient(
        config,
      ) as unknown as PartnerPortalClient
      const workspace = await loadPartnerWorkspace(portalClient)
      const app = workspace.applications[0] ?? null
      setAppContext(
        app
          ? { id: app.id, slug: app.referralSlug, companyName: app.companyName }
          : null,
      )
      const list = await listMySelections(selectionsClient)
      setSelections(list)
      setLoadState('loaded')
    } catch {
      setLoadState('error')
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startNew(): void {
    setDraft(EMPTY_DRAFT)
  }

  async function startEdit(summary: PartnerSelectionSummary): Promise<void> {
    setBusy(true)
    try {
      const detail = await getSelectionDetail(selectionsClient, summary.id)
      if (!detail) throw new Error('Sélection introuvable')
      const quantities = new Map<string, number>()
      for (const item of detail.items) {
        quantities.set(item.productId, item.quantity)
      }
      setDraft({
        id: detail.id,
        title: detail.title,
        comment: detail.comment ?? '',
        quantities,
      })
    } catch (err) {
      toast.error('Ouverture impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusy(false)
  }

  function draftItems(state: DraftState): SelectionItemInput[] {
    const items: SelectionItemInput[] = []
    for (const product of productsArray) {
      const qty = state.quantities.get(product.id) ?? 0
      if (qty > 0) items.push(buildSelectionItemInput(product, null, qty))
    }
    return items
  }

  async function save(publish: boolean): Promise<void> {
    if (!draft || !appContext) return
    const title = draft.title.trim()
    if (title === '') {
      toast.error('Donnez un titre à la sélection.')
      return
    }
    const items = draftItems(draft)
    if (items.length === 0) {
      toast.error('Ajoutez au moins un produit.')
      return
    }

    setBusy(true)
    try {
      const comment = draft.comment.trim() === '' ? null : draft.comment.trim()
      let id = draft.id
      if (id === null) {
        id = await createSelection(selectionsClient, {
          applicationId: appContext.id,
          title,
          comment,
          items,
        })
      } else {
        await updateSelectionMeta(selectionsClient, id, { title, comment })
        await replaceSelectionItems(selectionsClient, id, items)
      }
      if (publish) {
        await setSelectionStatus(selectionsClient, id, 'published')
      }
      toast.success(
        publish ? 'Sélection publiée' : 'Sélection enregistrée (brouillon)',
      )
      setDraft(null)
      await refresh()
    } catch (err) {
      toast.error('Enregistrement impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusy(false)
  }

  async function togglePublish(
    summary: PartnerSelectionSummary,
  ): Promise<void> {
    setBusy(true)
    try {
      await setSelectionStatus(
        selectionsClient,
        summary.id,
        summary.status === 'published' ? 'draft' : 'published',
      )
      await refresh()
    } catch (err) {
      toast.error('Action impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusy(false)
  }

  async function remove(summary: PartnerSelectionSummary): Promise<void> {
    setBusy(true)
    try {
      await deleteSelection(selectionsClient, summary.id)
      await refresh()
      toast.success('Sélection supprimée')
    } catch (err) {
      toast.error('Suppression impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusy(false)
  }

  async function copyLink(summary: PartnerSelectionSummary): Promise<void> {
    if (!appContext?.slug) {
      toast.error('Lien indisponible', {
        description:
          'Votre slug partenaire sera activé par notre équipe pour générer le lien.',
      })
      return
    }
    const path = buildPartnerSharePath({
      slug: appContext.slug,
      selectionId: summary.id,
    })
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${path}`
        : `https://prosimport.com${path}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien copié', { description: url })
    } catch {
      toast.error('Copie impossible', { description: url })
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <a
          href="/partner"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Espace partenaire
        </a>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-tight">
              Sélections co-brandées
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Préparez une sélection produits à partager. Le client voit les
              prix publics ; vos prix nets ne sont jamais exposés.
            </p>
          </div>
          {!draft && (
            <Button
              type="button"
              onClick={startNew}
              className="h-10 rounded-sm bg-foreground px-4 text-background"
            >
              <Plus className="h-4 w-4" />
              Nouvelle sélection
            </Button>
          )}
        </div>

        {draft ? (
          <SelectionBuilder
            draft={draft}
            products={productsArray}
            busy={busy}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={save}
          />
        ) : loadState === 'loading' ? (
          <div className="mt-8 space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/50"
              />
            ))}
          </div>
        ) : loadState === 'error' ? (
          <div className="mt-8 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            Impossible de charger vos sélections pour le moment.
          </div>
        ) : selections.length === 0 ? (
          <div className="mt-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune sélection pour l'instant. Créez-en une pour la partager à vos
            clients.
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {selections.map((summary) => (
              <li
                key={summary.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card px-4 py-3"
              >
                <div>
                  <div className="font-medium">{summary.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {summary.itemCount} produit
                    {summary.itemCount > 1 ? 's' : ''} ·{' '}
                    {summary.status === 'published'
                      ? 'Publiée'
                      : summary.status === 'archived'
                        ? 'Archivée'
                        : 'Brouillon'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void copyLink(summary)}
                    className="h-8 px-2 text-xs"
                  >
                    Copier le lien
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void togglePublish(summary)}
                    className="h-8 px-2 text-xs"
                  >
                    {summary.status === 'published' ? 'Dépublier' : 'Publier'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void startEdit(summary)}
                    className="h-8 px-2 text-xs"
                  >
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void remove(summary)}
                    className="h-8 px-2 text-xs text-red-700 hover:text-red-800"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  )
}

function SelectionBuilder({
  draft,
  products,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  readonly draft: DraftState
  readonly products: ReadonlyArray<Product>
  readonly busy: boolean
  readonly onChange: (next: DraftState) => void
  readonly onCancel: () => void
  readonly onSave: (publish: boolean) => void
}) {
  function setQty(productId: string, qty: number): void {
    const quantities = new Map(draft.quantities)
    if (qty <= 0) quantities.delete(productId)
    else quantities.set(productId, qty)
    onChange({ ...draft, quantities })
  }

  const selectedItems = products
    .filter((p) => (draft.quantities.get(p.id) ?? 0) > 0)
    .map((p) => ({
      quantity: draft.quantities.get(p.id) ?? 0,
      snapshot: {
        basePriceHt: p.basePriceHt,
      },
    }))
  const totalHt = selectionPublicTotalHt(
    selectedItems.map((i) => ({
      quantity: i.quantity,
      snapshot: {
        name: '',
        category: '',
        sku: '',
        imageUrl: '',
        ecoContribution: 0,
        basePriceHt: i.snapshot.basePriceHt,
      },
    })),
  )
  const totalUnits = selectionTotalUnits(selectedItems)

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Titre de la sélection
          </label>
          <Input
            value={draft.title}
            disabled={busy}
            placeholder="Ex. Terrasse restaurant bord de mer"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Note pour le client (optionnel)
          </label>
          <Input
            value={draft.comment}
            disabled={busy}
            placeholder="Ex. Sélection adaptée à votre projet 80 couverts"
            onChange={(e) => onChange({ ...draft, comment: e.target.value })}
            className="mt-1 h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const qty = draft.quantities.get(product.id) ?? 0
          return (
            <div
              key={product.id}
              className={`flex gap-3 rounded-md border p-2.5 ${
                qty > 0
                  ? 'border-[color:var(--ember)]/40 bg-[color:var(--ember)]/[0.05]'
                  : 'border-[color:var(--sand-deep)] bg-card'
              }`}
            >
              <img
                src={product.mainImageUrl}
                alt={product.name}
                className="h-16 w-16 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {product.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {CATEGORY_LABEL[product.category]} ·{' '}
                  {formatEUR(product.basePriceHt)} HT
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || qty === 0}
                    onClick={() => setQty(product.id, qty - 1)}
                    className="h-7 w-7 p-0"
                    aria-label="Retirer"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums">
                    {qty}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setQty(product.id, qty + 1)}
                    className="h-7 w-7 p-0"
                    aria-label="Ajouter"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/40 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {totalUnits} unité{totalUnits > 1 ? 's' : ''} · Total public{' '}
          <strong className="text-foreground">{formatEUR(totalHt)} HT</strong>
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
            className="h-9 px-3 text-sm"
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onSave(false)}
            className="h-9 px-3 text-sm"
          >
            Enregistrer le brouillon
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => onSave(true)}
            className="h-9 rounded-sm bg-foreground px-3 text-sm text-background"
          >
            Publier &amp; partager
          </Button>
        </div>
      </div>
    </div>
  )
}
