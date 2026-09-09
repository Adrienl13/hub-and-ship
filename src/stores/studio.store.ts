// Store Studio (lot 1 + lot 2) : état LOCAL persisté dans le navigateur
// (clé terrassea-studio-v1, version 4) avec journal d'actions inversibles
// (Undo, profondeur 50). Aucune persistance serveur ici.
//
// Deux espaces distincts, un seul store :
// - `project`   : la sélection EXPLICITE (« Choisir cette assise ») avec une
//                 quantité LIBRE (le MOQ n'arrondit rien) ;
// - `discovery` : les interactions de découverte (j'aime / pas pour moi /
//                 passer), les favoris locaux (❤️ = intérêt, jamais une
//                 décision de projet) et les finalistes (≤ 3).
// Chaque action journalise un snapshot complet des deux espaces : Undo
// restaure exactement l'état précédent, quelle que soit l'action.
//
// Pour un utilisateur connecté, les favoris sont en plus reflétés dans
// product_favorites par les fonctions existantes (hook useStudioFavoritesSync),
// sans que ce store en dépende : un anonyme reste pleinement servi.

import {
  sanitizeTables,
  reconcileTable,
  type TableConfiguration,
} from '@/lib/studio/table-project'
import type { TableCompatibilityData } from '@/lib/studio/compatibility'
import type { StudioProduct } from '@/lib/studio/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { StudioAlgorithmVersion } from '@/lib/studio/engine/versions'
import { MAX_FINALISTS } from '@/lib/studio/engine/scoring'
import type { InteractionAction } from '@/lib/studio/engine/types'
import type { StudioProjectItem, StudioRole } from '@/lib/studio/types'

export const STUDIO_STORE_KEY = 'terrassea-studio-v1'
export const STUDIO_STORE_VERSION = 4
export const STUDIO_UNDO_DEPTH = 50

export type StudioEntry = 'full_project' | 'seats' | 'tables'

export interface StudioProjectDraft {
  readonly tables?: ReadonlyArray<TableConfiguration>
  readonly entry: StudioEntry | null
  readonly items: ReadonlyArray<StudioProjectItem>
  readonly updatedAt: string | null
}

export interface StudioInteraction {
  readonly productId: string
  readonly action: InteractionAction
  readonly at: string
}

export interface StudioDiscoveryState {
  /** Historique complet des décisions de cartes (entrée du moteur). */
  readonly interactions: ReadonlyArray<StudioInteraction>
  /** Favoris locaux (❤️), dans l'ordre d'ajout. */
  readonly favoriteIds: ReadonlyArray<string>
  /** Finalistes sélectionnés explicitement, au plus MAX_FINALISTS. */
  readonly finalistIds: ReadonlyArray<string>
}

export type StudioActionLabel =
  | 'save_table'
  | 'remove_table'
  | 'set_entry'
  | 'upsert_item'
  | 'set_quantity'
  | 'remove_item'
  | 'clear_project'
  | 'decide'
  | 'favorite_add'
  | 'favorite_remove'
  | 'set_finalists'
  | 'add_finalist'
  | 'remove_finalist'
  | 'replace_finalist'
  | 'reset_discovery'

export interface StudioSnapshot {
  readonly project: StudioProjectDraft
  readonly discovery: StudioDiscoveryState
}

/** Entrée du journal : l'état complet AVANT l'action, pour l'inverser. */
export interface StudioJournalEntry {
  readonly label: StudioActionLabel
  readonly at: string
  readonly before: StudioSnapshot
}

export interface StudioStoreState extends StudioSnapshot {
  readonly saveTable: (
    table: TableConfiguration,
    products: ReadonlyArray<StudioProduct>,
    compatibility: TableCompatibilityData,
  ) => void
  readonly removeTable: (id: string) => void
  readonly algorithmVersion: StudioAlgorithmVersion | null
  readonly initializeAlgorithm: (version: StudioAlgorithmVersion) => void
  readonly sessionId: string
  readonly journal: ReadonlyArray<StudioJournalEntry>
  readonly setEntry: (entry: StudioEntry | null) => void
  readonly upsertItem: (item: StudioProjectItem) => void
  readonly setItemQuantity: (
    productId: string,
    variantId: string,
    requestedQuantity: number,
  ) => void
  readonly removeItem: (productId: string, variantId: string) => void
  readonly clearProject: () => void
  /** Décision sur une carte : j'aime ajoute aux favoris, pas pour moi retire. */
  readonly decide: (productId: string, action: InteractionAction) => void
  readonly addFavorite: (productId: string) => void
  readonly removeFavorite: (productId: string) => void
  readonly setFinalists: (ids: ReadonlyArray<string>) => void
  /** Refuse (false) au-delà de MAX_FINALISTS : jamais plus de 3 sélectionnés. */
  readonly addFinalist: (productId: string) => boolean
  readonly removeFinalist: (productId: string) => void
  readonly replaceFinalist: (previousId: string, nextId: string) => void
  readonly resetDiscovery: () => void
  readonly undo: () => boolean
  readonly canUndo: () => boolean
  readonly lastActionLabel: () => StudioActionLabel | null
  readonly resetSession: () => void
}

export function studioItemKey(productId: string, variantId: string): string {
  return `${productId}::${variantId}`
}

export function createStudioSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyProject(): StudioProjectDraft {
  return { entry: null, items: [], tables: [], updatedAt: null }
}

export function emptyDiscovery(): StudioDiscoveryState {
  return { interactions: [], favoriteIds: [], finalistIds: [] }
}

/** Quantité libre : entier ≥ 1, jamais arrondi à un MOQ. */
export function normalizeRequestedQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.trunc(value))
}

function pushJournal(
  journal: ReadonlyArray<StudioJournalEntry>,
  entry: StudioJournalEntry,
): ReadonlyArray<StudioJournalEntry> {
  const next = [...journal, entry]
  return next.length > STUDIO_UNDO_DEPTH
    ? next.slice(next.length - STUDIO_UNDO_DEPTH)
    : next
}

type Mutable = Pick<StudioStoreState, 'project' | 'discovery' | 'journal'>

function commit(
  state: Mutable,
  label: StudioActionLabel,
  next: Partial<StudioSnapshot>,
  now: string,
): Mutable {
  const project = next.project
    ? { ...next.project, updatedAt: now }
    : state.project
  const discovery = next.discovery ?? state.discovery
  return {
    project,
    discovery,
    journal: pushJournal(state.journal, {
      label,
      at: now,
      before: { project: state.project, discovery: state.discovery },
    }),
  }
}

function isRole(value: unknown): value is StudioRole {
  return (
    value === 'seat' ||
    value === 'tabletop' ||
    value === 'base' ||
    value === 'catalog_only'
  )
}

function isAction(value: unknown): value is InteractionAction {
  return value === 'like' || value === 'dislike' || value === 'pass'
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0,
      )
    : []
}

function sanitizeItems(value: unknown): StudioProjectItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): StudioProjectItem[] => {
    const item = (entry ?? {}) as Record<string, unknown>
    if (
      typeof item.productId !== 'string' ||
      typeof item.variantId !== 'string' ||
      !isRole(item.role)
    ) {
      return []
    }
    return [
      {
        productId: item.productId,
        variantId: item.variantId,
        role: item.role,
        requestedQuantity: normalizeRequestedQuantity(
          typeof item.requestedQuantity === 'number'
            ? item.requestedQuantity
            : 1,
        ),
        ...(item.customColour === true ? { customColour: true } : {}),
        ...(item.customDimensions === true ? { customDimensions: true } : {}),
      },
    ]
  })
}

function sanitizeProject(value: unknown): StudioProjectDraft {
  const legacy = (value ?? {}) as Record<string, unknown>
  return {
    entry:
      legacy.entry === 'full_project' ||
      legacy.entry === 'seats' ||
      legacy.entry === 'tables'
        ? legacy.entry
        : null,
    items: sanitizeItems(legacy.items),
    tables: sanitizeTables(legacy.tables),
    updatedAt: typeof legacy.updatedAt === 'string' ? legacy.updatedAt : null,
  }
}

function sanitizeDiscovery(value: unknown): StudioDiscoveryState {
  const raw = (value ?? {}) as Record<string, unknown>
  const interactions = Array.isArray(raw.interactions)
    ? raw.interactions.flatMap((entry): StudioInteraction[] => {
        const interaction = (entry ?? {}) as Record<string, unknown>
        if (
          typeof interaction.productId !== 'string' ||
          !isAction(interaction.action)
        )
          return []
        return [
          {
            productId: interaction.productId,
            action: interaction.action,
            at: typeof interaction.at === 'string' ? interaction.at : '',
          },
        ]
      })
    : []
  return {
    interactions,
    favoriteIds: [...new Set(stringList(raw.favoriteIds))],
    finalistIds: [...new Set(stringList(raw.finalistIds))].slice(
      0,
      MAX_FINALISTS,
    ),
  }
}

/**
 * Migration défensive : la session est toujours conservée ; le projet est
 * validé ligne par ligne ; la découverte (lot 2) repart vide pour les
 * versions antérieures à v2 ; les snapshots v2 sont conservés et la version
 * historique V0 est épinglée. Les nouvelles sessions v3 sont attribuées une fois.
 */
export function migrateStudioState(
  persisted: unknown,
  version: number,
): unknown {
  const raw = (persisted ?? {}) as Record<string, unknown>
  const sessionId =
    typeof raw.sessionId === 'string' && raw.sessionId.length > 0
      ? raw.sessionId
      : createStudioSessionId()
  if (version >= 2) {
    return {
      ...raw,
      algorithmVersion:
        version >= 3 && raw.algorithmVersion === null
          ? null
          : version >= 3 && raw.algorithmVersion === 'v1.0'
            ? 'v1.0'
            : 'v0.1',
      sessionId,
      project: sanitizeProject(raw.project),
      journal: Array.isArray(raw.journal)
        ? raw.journal
            .flatMap((entry) => {
              if (!entry || typeof entry !== 'object') return []
              const journal = entry as StudioJournalEntry
              if (
                !journal.before?.project ||
                !journal.before?.discovery ||
                typeof journal.label !== 'string'
              )
                return []
              return [
                {
                  ...journal,
                  before: {
                    project: sanitizeProject(journal.before.project),
                    discovery: sanitizeDiscovery(journal.before.discovery),
                  },
                },
              ]
            })
            .slice(-STUDIO_UNDO_DEPTH)
        : [],
      discovery: sanitizeDiscovery(raw.discovery),
    }
  }
  return {
    sessionId,
    algorithmVersion: 'v0.1',
    project: sanitizeProject(raw.project),
    discovery: emptyDiscovery(),
    journal: [],
  }
}

export const useStudioStore = create<StudioStoreState>()(
  persist(
    (set, get) => ({
      saveTable: (table, products, compatibility) =>
        set((state) => {
          const clean = sanitizeTables([table])[0]
          if (!clean) return state
          const next = reconcileTable(clean, products, compatibility)
          const tables = state.project.tables ?? []
          if (
            JSON.stringify(tables.find((t) => t.id === next.id)) ===
            JSON.stringify(next)
          )
            return state
          return commit(
            state,
            'save_table',
            {
              project: {
                ...state.project,
                tables: tables.some((t) => t.id === next.id)
                  ? tables.map((t) => (t.id === next.id ? next : t))
                  : [...tables, next],
              },
            },
            new Date().toISOString(),
          )
        }),
      removeTable: (id) =>
        set((state) => {
          const tables = state.project.tables ?? []
          if (!tables.some((t) => t.id === id)) return state
          return commit(
            state,
            'remove_table',
            {
              project: {
                ...state.project,
                tables: tables.filter((t) => t.id !== id),
              },
            },
            new Date().toISOString(),
          )
        }),
      algorithmVersion: null,
      initializeAlgorithm: (version) =>
        set((state) =>
          state.algorithmVersion ? state : { algorithmVersion: version },
        ),
      sessionId: createStudioSessionId(),
      project: emptyProject(),
      discovery: emptyDiscovery(),
      journal: [],
      setEntry: (entry) =>
        set((state) =>
          commit(
            state,
            'set_entry',
            { project: { ...state.project, entry } },
            new Date().toISOString(),
          ),
        ),
      upsertItem: (item) =>
        set((state) => {
          const key = studioItemKey(item.productId, item.variantId)
          const normalized: StudioProjectItem = {
            ...item,
            requestedQuantity: normalizeRequestedQuantity(
              item.requestedQuantity,
            ),
          }
          const exists = state.project.items.some(
            (entry) => studioItemKey(entry.productId, entry.variantId) === key,
          )
          const items = exists
            ? state.project.items.map((entry) =>
                studioItemKey(entry.productId, entry.variantId) === key
                  ? normalized
                  : entry,
              )
            : [...state.project.items, normalized]
          return commit(
            state,
            'upsert_item',
            { project: { ...state.project, items } },
            new Date().toISOString(),
          )
        }),
      setItemQuantity: (productId, variantId, requestedQuantity) =>
        set((state) => {
          const key = studioItemKey(productId, variantId)
          if (
            !state.project.items.some(
              (entry) =>
                studioItemKey(entry.productId, entry.variantId) === key,
            )
          ) {
            return state
          }
          const items = state.project.items.map((entry) =>
            studioItemKey(entry.productId, entry.variantId) === key
              ? {
                  ...entry,
                  requestedQuantity:
                    normalizeRequestedQuantity(requestedQuantity),
                }
              : entry,
          )
          return commit(
            state,
            'set_quantity',
            { project: { ...state.project, items } },
            new Date().toISOString(),
          )
        }),
      removeItem: (productId, variantId) =>
        set((state) => {
          const key = studioItemKey(productId, variantId)
          const items = state.project.items.filter(
            (entry) => studioItemKey(entry.productId, entry.variantId) !== key,
          )
          if (items.length === state.project.items.length) return state
          return commit(
            state,
            'remove_item',
            { project: { ...state.project, items } },
            new Date().toISOString(),
          )
        }),
      clearProject: () =>
        set((state) =>
          commit(
            state,
            'clear_project',
            { project: emptyProject() },
            new Date().toISOString(),
          ),
        ),
      decide: (productId, action) =>
        set((state) => {
          const now = new Date().toISOString()
          const interactions = [
            ...state.discovery.interactions,
            { productId, action, at: now },
          ]
          let favoriteIds = state.discovery.favoriteIds
          if (action === 'like' && !favoriteIds.includes(productId)) {
            favoriteIds = [...favoriteIds, productId]
          }
          if (action === 'dislike') {
            favoriteIds = favoriteIds.filter((id) => id !== productId)
          }
          return commit(
            state,
            'decide',
            { discovery: { ...state.discovery, interactions, favoriteIds } },
            now,
          )
        }),
      addFavorite: (productId) =>
        set((state) => {
          if (state.discovery.favoriteIds.includes(productId)) return state
          return commit(
            state,
            'favorite_add',
            {
              discovery: {
                ...state.discovery,
                favoriteIds: [...state.discovery.favoriteIds, productId],
              },
            },
            new Date().toISOString(),
          )
        }),
      removeFavorite: (productId) =>
        set((state) => {
          if (!state.discovery.favoriteIds.includes(productId)) return state
          return commit(
            state,
            'favorite_remove',
            {
              discovery: {
                ...state.discovery,
                favoriteIds: state.discovery.favoriteIds.filter(
                  (id) => id !== productId,
                ),
                finalistIds: state.discovery.finalistIds.filter(
                  (id) => id !== productId,
                ),
              },
            },
            new Date().toISOString(),
          )
        }),
      setFinalists: (ids) =>
        set((state) => {
          const finalistIds = [...new Set(ids)].slice(0, MAX_FINALISTS)
          return commit(
            state,
            'set_finalists',
            { discovery: { ...state.discovery, finalistIds } },
            new Date().toISOString(),
          )
        }),
      addFinalist: (productId) => {
        const state = get()
        if (state.discovery.finalistIds.includes(productId)) return true
        if (state.discovery.finalistIds.length >= MAX_FINALISTS) return false
        set((current) =>
          commit(
            current,
            'add_finalist',
            {
              discovery: {
                ...current.discovery,
                finalistIds: [...current.discovery.finalistIds, productId],
              },
            },
            new Date().toISOString(),
          ),
        )
        return true
      },
      removeFinalist: (productId) =>
        set((state) => {
          if (!state.discovery.finalistIds.includes(productId)) return state
          return commit(
            state,
            'remove_finalist',
            {
              discovery: {
                ...state.discovery,
                finalistIds: state.discovery.finalistIds.filter(
                  (id) => id !== productId,
                ),
              },
            },
            new Date().toISOString(),
          )
        }),
      replaceFinalist: (previousId, nextId) =>
        set((state) => {
          if (!state.discovery.finalistIds.includes(previousId)) return state
          if (state.discovery.finalistIds.includes(nextId)) return state
          return commit(
            state,
            'replace_finalist',
            {
              discovery: {
                ...state.discovery,
                finalistIds: state.discovery.finalistIds.map((id) =>
                  id === previousId ? nextId : id,
                ),
              },
            },
            new Date().toISOString(),
          )
        }),
      resetDiscovery: () =>
        set((state) =>
          commit(
            state,
            'reset_discovery',
            { discovery: emptyDiscovery() },
            new Date().toISOString(),
          ),
        ),
      undo: () => {
        const state = get()
        const last = state.journal[state.journal.length - 1]
        if (!last) return false
        set({
          project: last.before.project,
          discovery: last.before.discovery,
          journal: state.journal.slice(0, -1),
        })
        return true
      },
      canUndo: () => get().journal.length > 0,
      lastActionLabel: () =>
        get().journal[get().journal.length - 1]?.label ?? null,
      resetSession: () =>
        set({
          algorithmVersion: null,
          sessionId: createStudioSessionId(),
          project: emptyProject(),
          discovery: emptyDiscovery(),
          journal: [],
        }),
    }),
    {
      name: STUDIO_STORE_KEY,
      version: STUDIO_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        algorithmVersion: state.algorithmVersion,
        sessionId: state.sessionId,
        project: state.project,
        discovery: state.discovery,
        journal: state.journal,
      }),
      migrate: migrateStudioState,
    },
  ),
)
