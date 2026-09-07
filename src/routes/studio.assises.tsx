// /studio/assises — tranche verticale Assises (lot 2).
//
// Découverte carte par carte (moteur V0), J'aime / Pas pour moi / Passer,
// Undo, favoris, finalistes (≤ 3), choix explicite, quantité libre, rail
// projet desktop / barre projet mobile. Tout l'état vit dans le store
// terrassea-studio-v1 ; le catalogue vient des surfaces publiques Studio ;
// aucune vérité commerciale n'est produite ici.
//
// `?set=<id>` : restreint la découverte à un jeu curé ACTIF s'il existe en
// base. Sinon, découverte complète et message explicite.

import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { DecisionCard } from '@/components/studio/DecisionCard'
import { FavoritesTray } from '@/components/studio/FavoritesTray'
import { Finalists } from '@/components/studio/Finalists'
import { ProjectBottomBar } from '@/components/studio/ProjectBottomBar'
import { ProjectRail } from '@/components/studio/ProjectRail'
import { SeatQuantityField } from '@/components/studio/SeatQuantityField'
import { StudioProductDetails } from '@/components/studio/StudioProductDetails'
import { StudioShell } from '@/components/studio/StudioShell'
import { UndoButton } from '@/components/studio/UndoButton'
import { useStudioCatalog } from '@/hooks/useStudioCatalog'
import { useStudioFavoritesSync } from '@/hooks/useStudioFavoritesSync'
import { markStudioStarted, useStudioTracker } from '@/hooks/useStudioTracker'
import { buildDiscoveryPool, cardImageUrl } from '@/lib/studio/discovery'
import {
  affinityFromHistory,
  moreFinalistCandidates,
  nextCard,
  selectFinalists,
  type EngineState,
  type Interaction,
} from '@/lib/studio/engine'
import { isStudioEnabled } from '@/lib/studio/flags'
import type { StudioProduct, StudioProjectItem } from '@/lib/studio/types'
import { buildSeoHead } from '@/lib/seo'
import { useStudioStore, type StudioEntry } from '@/stores/studio.store'

const SET_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/

function isEntry(value: unknown): value is StudioEntry {
  return value === 'full_project' || value === 'seats' || value === 'tables'
}

export const Route = createFileRoute('/studio/assises')({
  // ?entry= : porté par les liens de /studio (fiable avant hydratation) ;
  // ?set= : jeu curé (preview).
  validateSearch: (search: Record<string, unknown>): { set?: string; entry?: StudioEntry } => ({
    ...(typeof search.set === 'string' && SET_PATTERN.test(search.set) ? { set: search.set } : {}),
    ...(isEntry(search.entry) ? { entry: search.entry } : {}),
  }),
  head: () =>
    buildSeoHead({
      title: 'Studio Projet — Assises',
      description: 'Découvrez des assises variées, gardez vos favoris, choisissez et fixez votre quantité.',
      path: '/studio/assises',
      noindex: !isStudioEnabled(),
    }),
  component: StudioSeatsPage,
})

type Stage = 'discover' | 'finalists' | 'quantity'

function StudioSeatsPage() {
  const { set, entry: requestedEntry } = Route.useSearch()
  const catalogState = useStudioCatalog()
  const tracker = useStudioTracker()
  const favoritesSync = useStudioFavoritesSync()

  const sessionId = useStudioStore((state) => state.sessionId)
  const project = useStudioStore((state) => state.project)
  const discovery = useStudioStore((state) => state.discovery)
  const canUndo = useStudioStore((state) => state.journal.length > 0)
  const store = useStudioStore

  const [stage, setStage] = useState<Stage>('discover')
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [quantityKey, setQuantityKey] = useState<string | null>(null)
  const [moreIds, setMoreIds] = useState<ReadonlyArray<string>>([])

  // L'entrée vient de l'URL (liens de /studio) ; accès direct sans entrée
  // choisie : « Assises » par défaut.
  useEffect(() => {
    const current = store.getState().project.entry
    if (requestedEntry && requestedEntry !== current) store.getState().setEntry(requestedEntry)
    else if (current === null) store.getState().setEntry('seats')
    markStudioStarted(sessionId, store.getState().project.entry ?? 'seats')
  }, [requestedEntry, sessionId, store])

  const pool = useMemo(
    () => (catalogState.catalog ? buildDiscoveryPool(catalogState.catalog, { set }) : null),
    [catalogState.catalog, set],
  )
  const productsById = useMemo(() => {
    const map = new Map<string, StudioProduct>()
    for (const product of catalogState.catalog?.products ?? []) map.set(product.id, product)
    return map
  }, [catalogState.catalog])
  const context = catalogState.catalog?.context ?? { stock: [], options: [] }

  const history = useMemo<ReadonlyArray<Interaction>>(
    () => discovery.interactions.map(({ productId, action }) => ({ productId, action })),
    [discovery.interactions],
  )
  const engineState = useMemo<EngineState>(() => ({ sessionId, history }), [sessionId, history])
  const card = useMemo(() => (pool ? nextCard(engineState, pool.engineCatalogue) : null), [pool, engineState])
  const current = card && pool ? (pool.seatsById.get(card.productId) ?? null) : null

  // Préchargement des 2 cartes suivantes (simulation « passer »).
  useEffect(() => {
    if (!pool || !card || typeof window === 'undefined') return
    let state: EngineState = { sessionId, history: [...history, { productId: card.productId, action: 'pass' }] }
    const preloads: HTMLImageElement[] = []
    for (let index = 0; index < 2; index += 1) {
      const next = nextCard(state, pool.engineCatalogue)
      if (!next) break
      const product = pool.seatsById.get(next.productId)
      if (product) {
        const image = new Image()
        image.src = cardImageUrl(product)
        preloads.push(image)
      }
      state = { sessionId, history: [...state.history, { productId: next.productId, action: 'pass' }] }
    }
    return () => {
      for (const image of preloads) image.src = ''
    }
  }, [pool, card, history, sessionId])

  const favorites = useMemo(
    () => discovery.favoriteIds.flatMap((id) => productsById.get(id) ?? []),
    [discovery.favoriteIds, productsById],
  )
  const finalistProducts = useMemo(
    () => discovery.finalistIds.flatMap((id) => productsById.get(id) ?? []),
    [discovery.finalistIds, productsById],
  )
  const selection = useMemo(() => {
    if (!pool) return null
    const seatsById = new Map(pool.engineCatalogue.seats.map((seat) => [seat.id, seat] as const))
    return selectFinalists(discovery.favoriteIds, affinityFromHistory(history, seatsById), seatsById)
  }, [pool, discovery.favoriteIds, history])

  const mirrorDiff = useCallback(
    (before: ReadonlyArray<string>, after: ReadonlyArray<string>) => {
      for (const id of after) if (!before.includes(id)) favoritesSync.mirror(id, true)
      for (const id of before) if (!after.includes(id)) favoritesSync.mirror(id, false)
    },
    [favoritesSync],
  )

  const decide = useCallback(
    (action: Interaction['action']) => {
      if (!card || !current) return
      const before = store.getState().discovery.favoriteIds
      store.getState().decide(card.productId, action)
      mirrorDiff(before, store.getState().discovery.favoriteIds)
      const type = action === 'like' ? 'card_liked' : action === 'dislike' ? 'card_disliked' : 'card_passed'
      tracker.track(type, { productId: card.productId, payload: { position: card.position, reason: card.reason } })
    },
    [card, current, store, mirrorDiff, tracker],
  )
  const onLike = useCallback(() => decide('like'), [decide])
  const onDislike = useCallback(() => decide('dislike'), [decide])
  const onPass = useCallback(() => decide('pass'), [decide])

  const onUndo = useCallback(() => {
    const state = store.getState()
    const label = state.lastActionLabel()
    const before = state.discovery.favoriteIds
    if (!state.undo()) return
    mirrorDiff(before, store.getState().discovery.favoriteIds)
    tracker.track('undo', { payload: { undone: label ?? undefined } })
  }, [store, mirrorDiff, tracker])

  const removeFavorite = useCallback(
    (productId: string) => {
      store.getState().removeFavorite(productId)
      favoritesSync.mirror(productId, false)
      tracker.track('favorite_removed', { productId })
    },
    [store, favoritesSync, tracker],
  )

  const toggleFavorite = useCallback(
    (productId: string) => {
      if (store.getState().discovery.favoriteIds.includes(productId)) {
        removeFavorite(productId)
        return
      }
      store.getState().addFavorite(productId)
      favoritesSync.mirror(productId, true)
      tracker.track('favorite_added', { productId })
    },
    [store, favoritesSync, tracker, removeFavorite],
  )

  const openFinalists = useCallback(() => {
    if (selection && store.getState().discovery.finalistIds.length === 0) {
      store.getState().setFinalists(selection.finalistIds)
    }
    setMoreIds([])
    setStage('finalists')
    tracker.track('finalists_viewed', { payload: { finalists: Math.min(3, store.getState().discovery.finalistIds.length) } })
  }, [selection, store, tracker])

  const showMore = useCallback(() => {
    if (!selection) return
    const shown = [...moreIds, ...store.getState().discovery.finalistIds]
    setMoreIds((current) => [...current, ...moreFinalistCandidates(selection, shown)])
  }, [selection, moreIds, store])

  const replaceFinalist = useCallback(
    (candidateId: string) => {
      const state = store.getState()
      if (!state.addFinalist(candidateId)) {
        const last = state.discovery.finalistIds[state.discovery.finalistIds.length - 1]
        if (last) state.replaceFinalist(last, candidateId)
      }
      setMoreIds((current) => current.filter((id) => id !== candidateId))
    },
    [store],
  )

  const choose = useCallback(
    (productId: string, variantId?: string) => {
      const product = productsById.get(productId)
      if (!product) return
      const variant = variantId ?? product.variants[0]?.id
      if (!variant) return
      const existing = store
        .getState()
        .project.items.find((item) => item.productId === productId && item.variantId === variant)
      const item: StudioProjectItem = existing ?? {
        productId,
        variantId: variant,
        requestedQuantity: 1,
        role: 'seat',
      }
      if (!existing) store.getState().upsertItem(item)
      tracker.track('seat_selected', { productId, variantId: variant })
      setDetailsId(null)
      setQuantityKey(`${productId}::${variant}`)
      setStage('quantity')
    },
    [productsById, store, tracker],
  )

  const setQuantity = useCallback(
    (item: StudioProjectItem, quantity: number) => {
      store.getState().setItemQuantity(item.productId, item.variantId, quantity)
      const stored = store
        .getState()
        .project.items.find((entry) => entry.productId === item.productId && entry.variantId === item.variantId)
      tracker.track('quantity_changed', {
        productId: item.productId,
        variantId: item.variantId,
        payload: { quantity: stored?.requestedQuantity ?? Math.max(1, Math.trunc(quantity)) },
      })
    },
    [store, tracker],
  )

  const removeItem = useCallback(
    (item: StudioProjectItem) => {
      store.getState().removeItem(item.productId, item.variantId)
      if (quantityKey === `${item.productId}::${item.variantId}`) {
        setQuantityKey(null)
        setStage('discover')
      }
    },
    [store, quantityKey],
  )

  const quantityItem = quantityKey
    ? (project.items.find((item) => `${item.productId}::${item.variantId}` === quantityKey) ?? null)
    : null
  const quantityProduct = quantityItem ? (productsById.get(quantityItem.productId) ?? null) : null
  const detailsProduct = detailsId ? (productsById.get(detailsId) ?? null) : null

  const summaryProps = {
    entry: project.entry,
    items: project.items,
    productsById,
    context,
    onQuantityChange: setQuantity,
    onRemove: removeItem,
    onEditQuantity: (item: StudioProjectItem) => {
      setQuantityKey(`${item.productId}::${item.variantId}`)
      setStage('quantity')
    },
  }

  return (
    <StudioShell rail={<ProjectRail {...summaryProps} />} bottomBar={<ProjectBottomBar {...summaryProps} />}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/studio"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Studio
          </Link>
          <span className="label-eyebrow text-[color:var(--ember)]">Assises</span>
        </div>
        <div className="flex items-center gap-2">
          {stage !== 'discover' && (
            <button
              type="button"
              onClick={() => setStage('discover')}
              className="inline-flex min-h-[44px] items-center rounded-md border border-[color:var(--sand-deep)] px-4 text-sm font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
            >
              Continuer la découverte
            </button>
          )}
          <UndoButton onUndo={onUndo} canUndo={canUndo} />
        </div>
      </div>

      {pool?.curationMissing && (
        <p role="status" className="mb-4 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-3 text-sm">
          Le jeu « {set} » n&apos;est pas disponible : découverte sur toutes les assises.
        </p>
      )}
      {pool?.curationSet && (
        <p role="status" className="mb-4 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-3 text-sm">
          Jeu « {pool.curationSet.label} » : {pool.seats.length} assises.
        </p>
      )}

      {catalogState.status === 'loading' && (
        <div className="aspect-[4/3] animate-pulse rounded-lg bg-[color:var(--sand-deep)]/50" aria-busy="true" aria-label="Chargement des assises" />
      )}
      {catalogState.status === 'error' && (
        <p role="alert" className="rounded-md border border-[color:var(--stamp)]/40 bg-[color:var(--stamp-bg)] p-4 text-sm">
          Les assises n&apos;ont pas pu être chargées. Réessayez dans un instant.
        </p>
      )}
      {catalogState.status === 'ready' && pool && pool.seats.length === 0 && (
        <p className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-4 text-sm">
          Aucune assise n&apos;est disponible pour la découverte pour le moment.
        </p>
      )}

      {catalogState.status === 'ready' && pool && pool.seats.length > 0 && stage === 'discover' && (
        <div className="space-y-6">
          <div>
            <p className="label-eyebrow text-[color:var(--ink-soft)]">Voici des assises variées</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Gardez ce qui vous plaît, écartez le reste.
            </h1>
          </div>
          {current && card ? (
            <DecisionCard
              product={current}
              position={card.position}
              total={pool.seats.length}
              onLike={onLike}
              onDislike={onDislike}
              onPass={onPass}
              onUndo={onUndo}
              onDetails={() => setDetailsId(current.id)}
              shortcutsEnabled={detailsId === null}
            />
          ) : (
            <div className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-6" data-testid="discovery-exhausted">
              <h2 className="font-display text-xl font-bold">Vous avez vu toutes les assises.</h2>
              <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                Passez à vos finalistes, ou recommencez la découverte (vos favoris sont conservés).
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openFinalists}
                  disabled={favorites.length === 0}
                  className="inline-flex min-h-[44px] items-center rounded-md bg-[color:var(--ink)] px-4 text-sm font-semibold text-[color:var(--sand)] hover:bg-[color:var(--ink-soft)] disabled:opacity-40"
                >
                  Vos finalistes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const favoriteIds = store.getState().discovery.favoriteIds
                    store.getState().resetDiscovery()
                    for (const id of favoriteIds) store.getState().addFavorite(id)
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[color:var(--sand-deep)] px-4 text-sm font-medium hover:border-[color:var(--ink)]"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Revoir les assises
                </button>
              </div>
            </div>
          )}
          <FavoritesTray
            favorites={favorites}
            onRemove={removeFavorite}
            onOpenFinalists={openFinalists}
            onOpenDetails={setDetailsId}
          />
        </div>
      )}

      {catalogState.status === 'ready' && pool && stage === 'finalists' && (
        <Finalists
          finalists={finalistProducts}
          moreCandidates={moreIds.flatMap((id) => productsById.get(id) ?? [])}
          canShowMore={Boolean(selection && moreFinalistCandidates(selection, [...moreIds, ...discovery.finalistIds]).length > 0)}
          onShowMore={showMore}
          onChoose={(productId) => choose(productId)}
          onOpenDetails={setDetailsId}
          onRemove={(productId) => store.getState().removeFinalist(productId)}
          onReplace={replaceFinalist}
        />
      )}

      {stage === 'quantity' && quantityItem && quantityProduct && (
        <section aria-label="Quantité" className="space-y-6" data-testid="quantity-stage">
          <div>
            <p className="label-eyebrow text-[color:var(--ember)]">Votre choix</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{quantityProduct.name}</h1>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Cette assise est dans votre projet. Indiquez la quantité souhaitée : aucune quantité n&apos;est
              refusée, nous vous disons simplement ce qui est confirmé et ce qui demande une étude.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,240px)_1fr]">
            <div className="aspect-square overflow-hidden rounded-lg border border-[color:var(--sand-deep)] bg-white">
              <img
                src={cardImageUrl(quantityProduct, quantityItem.variantId)}
                alt={quantityProduct.name}
                className="h-full w-full object-contain p-4"
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="space-y-4">
              <SeatQuantityField item={quantityItem} product={quantityProduct} context={context} onChange={(quantity) => setQuantity(quantityItem, quantity)} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStage('discover')}
                  className="inline-flex min-h-[44px] items-center rounded-md bg-[color:var(--ink)] px-4 text-sm font-semibold text-[color:var(--sand)] hover:bg-[color:var(--ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                  data-testid="quantity-continue"
                >
                  Continuer la découverte
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsId(quantityProduct.id)}
                  className="inline-flex min-h-[44px] items-center rounded-md border border-[color:var(--sand-deep)] px-4 text-sm font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2"
                >
                  Changer de design
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <StudioProductDetails
        product={detailsProduct}
        open={detailsProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsId(null)
        }}
        showPrice={stage !== 'discover'}
        isFavorite={detailsProduct ? discovery.favoriteIds.includes(detailsProduct.id) : false}
        onToggleFavorite={toggleFavorite}
        onChoose={(productId, variantId) => choose(productId, variantId)}
        initialVariantId={quantityItem && detailsProduct?.id === quantityItem.productId ? quantityItem.variantId : undefined}
      />
    </StudioShell>
  )
}
