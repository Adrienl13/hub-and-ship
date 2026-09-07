import { beforeEach, describe, expect, it } from 'vitest'

import {
  STUDIO_STORE_KEY,
  STUDIO_STORE_VERSION,
  STUDIO_UNDO_DEPTH,
  migrateStudioState,
  normalizeRequestedQuantity,
  useStudioStore,
} from '@/stores/studio.store'

describe('store Studio (fondation)', () => {
  beforeEach(() => {
    localStorage.clear()
    useStudioStore.getState().resetSession()
  })

  it('persiste sous la clé et la version prévues, sans favoris', () => {
    expect(STUDIO_STORE_KEY).toBe('terrassea-studio-v1')
    expect(STUDIO_STORE_VERSION).toBe(1)
    useStudioStore.getState().setEntry('seats')
    const persisted = JSON.parse(localStorage.getItem(STUDIO_STORE_KEY) ?? '{}') as {
      version: number
      state: Record<string, unknown>
    }
    expect(persisted.version).toBe(1)
    expect(Object.keys(persisted.state).sort()).toEqual(['journal', 'project', 'sessionId'])
    expect(persisted.state).not.toHaveProperty('favorites')
  })

  it('accepte une quantité libre (6 sous un MOQ de 50) sans arrondi', () => {
    const store = useStudioStore.getState()
    store.upsertItem({ productId: 'chair', variantId: 'std', requestedQuantity: 6, role: 'seat' })
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(6)
    store.setItemQuantity('chair', 'std', 53)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(53)
    expect(normalizeRequestedQuantity(0)).toBe(1)
    expect(normalizeRequestedQuantity(2.9)).toBe(2)
    expect(normalizeRequestedQuantity(Number.NaN)).toBe(1)
  })

  it('Undo restaure exactement l’état précédent, action par action', () => {
    const store = useStudioStore.getState()
    store.setEntry('full_project')
    store.upsertItem({ productId: 'a', variantId: 'v', requestedQuantity: 10, role: 'seat' })
    store.setItemQuantity('a', 'v', 12)
    store.removeItem('a', 'v')
    expect(useStudioStore.getState().project.items).toHaveLength(0)
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(12)
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(10)
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.items).toHaveLength(0)
    expect(useStudioStore.getState().project.entry).toBe('full_project')
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.entry).toBeNull()
    expect(useStudioStore.getState().undo()).toBe(false)
    expect(useStudioStore.getState().canUndo()).toBe(false)
  })

  it('le journal est plafonné à 50 actions inversibles', () => {
    const store = useStudioStore.getState()
    store.upsertItem({ productId: 'a', variantId: 'v', requestedQuantity: 1, role: 'seat' })
    for (let quantity = 2; quantity <= 80; quantity += 1) {
      store.setItemQuantity('a', 'v', quantity)
    }
    expect(useStudioStore.getState().journal).toHaveLength(STUDIO_UNDO_DEPTH)
    let undone = 0
    while (useStudioStore.getState().undo()) undone += 1
    expect(undone).toBe(STUDIO_UNDO_DEPTH)
    // 80 → 50 retours en arrière → la quantité 30 (la 31e mutation) est la
    // plus ancienne restaurable ; la création initiale n'est plus annulable.
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(30)
  })

  it('les actions sans effet ne créent pas d’entrée de journal', () => {
    const store = useStudioStore.getState()
    store.setItemQuantity('inconnu', 'v', 3)
    store.removeItem('inconnu', 'v')
    expect(useStudioStore.getState().journal).toHaveLength(0)
  })

  it('migre un état de version antérieure sans perdre la session ni les lignes valides', () => {
    const migrated = migrateStudioState(
      {
        sessionId: 'session-ancienne',
        project: {
          entry: 'seats',
          items: [
            { productId: 'a', variantId: 'v', requestedQuantity: 0, role: 'seat' },
            { productId: 'b', variantId: 'v', requestedQuantity: 4, role: 'style_tag' },
            { productId: 42, variantId: 'v', requestedQuantity: 4, role: 'seat' },
          ],
        },
        favorites: ['a'],
      },
      0,
    ) as { sessionId: string; project: { entry: string; items: unknown[] }; journal: unknown[] }
    expect(migrated.sessionId).toBe('session-ancienne')
    expect(migrated.project.entry).toBe('seats')
    expect(migrated.project.items).toEqual([
      { productId: 'a', variantId: 'v', role: 'seat', requestedQuantity: 1 },
    ])
    expect(migrated.journal).toEqual([])
    expect(migrated).not.toHaveProperty('favorites')
  })

  it('génère une session si l’état persisté n’en a pas', () => {
    const migrated = migrateStudioState({}, 0) as { sessionId: string }
    expect(migrated.sessionId.length).toBeGreaterThan(8)
  })
})
