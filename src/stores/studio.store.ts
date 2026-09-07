// Store Studio (lot 1) : état LOCAL du projet en cours, persisté dans le
// navigateur (clé terrassea-studio-v1), avec journal d'actions inversibles
// (Undo, profondeur 50). Aucune persistance serveur, aucun favori : les
// favoris existants (product_favorites) restent un système distinct — un
// favori n'est pas une décision de projet.
//
// Les interactions de découverte (j'aime / passer / finalistes) arrivent au
// lot 2 ; ce store fournit seulement la fondation testable : session,
// entrée, lignes de projet à quantité LIBRE (le MOQ n'arrondit rien ici),
// undo, reset, migration de version.

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { StudioProjectItem, StudioRole } from '@/lib/studio/types'

export const STUDIO_STORE_KEY = 'terrassea-studio-v1'
export const STUDIO_STORE_VERSION = 1
export const STUDIO_UNDO_DEPTH = 50

export type StudioEntry = 'full_project' | 'seats' | 'tables'

export interface StudioProjectDraft {
  readonly entry: StudioEntry | null
  readonly items: ReadonlyArray<StudioProjectItem>
  readonly updatedAt: string | null
}

export type StudioActionLabel =
  | 'set_entry'
  | 'upsert_item'
  | 'set_quantity'
  | 'remove_item'
  | 'clear_project'

/** Entrée du journal : l'état du projet AVANT l'action, pour l'inverser. */
export interface StudioJournalEntry {
  readonly label: StudioActionLabel
  readonly at: string
  readonly before: StudioProjectDraft
}

export interface StudioStoreState {
  readonly sessionId: string
  readonly project: StudioProjectDraft
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
  readonly undo: () => boolean
  readonly canUndo: () => boolean
  readonly resetSession: () => void
}

export function studioItemKey(productId: string, variantId: string): string {
  return `${productId}::${variantId}`
}

export function createStudioSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyProject(): StudioProjectDraft {
  return { entry: null, items: [], updatedAt: null }
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

function withJournal(
  state: Pick<StudioStoreState, 'project' | 'journal'>,
  label: StudioActionLabel,
  project: StudioProjectDraft,
  now: string,
): Pick<StudioStoreState, 'project' | 'journal'> {
  return {
    project: { ...project, updatedAt: now },
    journal: pushJournal(state.journal, { label, at: now, before: state.project }),
  }
}

function isRole(value: unknown): value is StudioRole {
  return (
    value === 'seat' || value === 'tabletop' || value === 'base' || value === 'catalog_only'
  )
}

/** Migration défensive : toute version inconnue repart d'un projet vide en
 *  conservant la session ; les lignes valides d'un brouillon v0 sont gardées. */
export function migrateStudioState(persisted: unknown, version: number): unknown {
  const raw = (persisted ?? {}) as Record<string, unknown>
  const sessionId =
    typeof raw.sessionId === 'string' && raw.sessionId.length > 0
      ? raw.sessionId
      : createStudioSessionId()
  if (version >= STUDIO_STORE_VERSION) return { ...raw, sessionId }

  const legacy = (raw.project ?? {}) as Record<string, unknown>
  const items = Array.isArray(legacy.items)
    ? legacy.items.flatMap((entry): StudioProjectItem[] => {
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
              typeof item.requestedQuantity === 'number' ? item.requestedQuantity : 1,
            ),
          },
        ]
      })
    : []
  return {
    sessionId,
    project: {
      entry:
        legacy.entry === 'full_project' || legacy.entry === 'seats' || legacy.entry === 'tables'
          ? legacy.entry
          : null,
      items,
      updatedAt: typeof legacy.updatedAt === 'string' ? legacy.updatedAt : null,
    },
    journal: [],
  }
}

export const useStudioStore = create<StudioStoreState>()(
  persist(
    (set, get) => ({
      sessionId: createStudioSessionId(),
      project: emptyProject(),
      journal: [],
      setEntry: (entry) =>
        set((state) =>
          withJournal(
            state,
            'set_entry',
            { ...state.project, entry },
            new Date().toISOString(),
          ),
        ),
      upsertItem: (item) =>
        set((state) => {
          const key = studioItemKey(item.productId, item.variantId)
          const normalized: StudioProjectItem = {
            ...item,
            requestedQuantity: normalizeRequestedQuantity(item.requestedQuantity),
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
          return withJournal(
            state,
            'upsert_item',
            { ...state.project, items },
            new Date().toISOString(),
          )
        }),
      setItemQuantity: (productId, variantId, requestedQuantity) =>
        set((state) => {
          const key = studioItemKey(productId, variantId)
          if (
            !state.project.items.some(
              (entry) => studioItemKey(entry.productId, entry.variantId) === key,
            )
          ) {
            return state
          }
          const items = state.project.items.map((entry) =>
            studioItemKey(entry.productId, entry.variantId) === key
              ? {
                  ...entry,
                  requestedQuantity: normalizeRequestedQuantity(requestedQuantity),
                }
              : entry,
          )
          return withJournal(
            state,
            'set_quantity',
            { ...state.project, items },
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
          return withJournal(
            state,
            'remove_item',
            { ...state.project, items },
            new Date().toISOString(),
          )
        }),
      clearProject: () =>
        set((state) =>
          withJournal(state, 'clear_project', emptyProject(), new Date().toISOString()),
        ),
      undo: () => {
        const state = get()
        const last = state.journal[state.journal.length - 1]
        if (!last) return false
        set({ project: last.before, journal: state.journal.slice(0, -1) })
        return true
      },
      canUndo: () => get().journal.length > 0,
      resetSession: () =>
        set({ sessionId: createStudioSessionId(), project: emptyProject(), journal: [] }),
    }),
    {
      name: STUDIO_STORE_KEY,
      version: STUDIO_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        project: state.project,
        journal: state.journal,
      }),
      migrate: migrateStudioState,
    },
  ),
)
