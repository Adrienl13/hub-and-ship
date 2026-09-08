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

  it('persiste sous la clé et la version prévues', () => {
    expect(STUDIO_STORE_KEY).toBe('terrassea-studio-v1')
    expect(STUDIO_STORE_VERSION).toBe(3)
    useStudioStore.getState().setEntry('seats')
    const persisted = JSON.parse(
      localStorage.getItem(STUDIO_STORE_KEY) ?? '{}',
    ) as {
      version: number
      state: Record<string, unknown>
    }
    expect(persisted.version).toBe(3)
    expect(Object.keys(persisted.state).sort()).toEqual([
      'algorithmVersion',
      'discovery',
      'journal',
      'project',
      'sessionId',
    ])
  })

  it('accepte une quantité libre (6 sous un MOQ de 50) sans arrondi', () => {
    const store = useStudioStore.getState()
    store.upsertItem({
      productId: 'chair',
      variantId: 'std',
      requestedQuantity: 6,
      role: 'seat',
    })
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(
      6,
    )
    store.setItemQuantity('chair', 'std', 53)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(
      53,
    )
    expect(normalizeRequestedQuantity(0)).toBe(1)
    expect(normalizeRequestedQuantity(2.9)).toBe(2)
    expect(normalizeRequestedQuantity(Number.NaN)).toBe(1)
  })

  it('Undo restaure exactement l’état précédent, action par action', () => {
    const store = useStudioStore.getState()
    store.setEntry('full_project')
    store.upsertItem({
      productId: 'a',
      variantId: 'v',
      requestedQuantity: 10,
      role: 'seat',
    })
    store.setItemQuantity('a', 'v', 12)
    store.removeItem('a', 'v')
    expect(useStudioStore.getState().project.items).toHaveLength(0)
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(
      12,
    )
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(
      10,
    )
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
    store.upsertItem({
      productId: 'a',
      variantId: 'v',
      requestedQuantity: 1,
      role: 'seat',
    })
    for (let quantity = 2; quantity <= 80; quantity += 1) {
      store.setItemQuantity('a', 'v', quantity)
    }
    expect(useStudioStore.getState().journal).toHaveLength(STUDIO_UNDO_DEPTH)
    let undone = 0
    while (useStudioStore.getState().undo()) undone += 1
    expect(undone).toBe(STUDIO_UNDO_DEPTH)
    expect(useStudioStore.getState().project.items[0]?.requestedQuantity).toBe(
      30,
    )
  })

  it('les actions sans effet ne créent pas d’entrée de journal', () => {
    const store = useStudioStore.getState()
    store.setItemQuantity('inconnu', 'v', 3)
    store.removeItem('inconnu', 'v')
    store.removeFavorite('inconnu')
    store.removeFinalist('inconnu')
    store.replaceFinalist('inconnu', 'autre')
    expect(useStudioStore.getState().journal).toHaveLength(0)
  })

  it('migre un état v0 sans perdre la session ni les lignes valides', () => {
    const migrated = migrateStudioState(
      {
        sessionId: 'session-ancienne',
        project: {
          entry: 'seats',
          items: [
            {
              productId: 'a',
              variantId: 'v',
              requestedQuantity: 0,
              role: 'seat',
            },
            {
              productId: 'b',
              variantId: 'v',
              requestedQuantity: 4,
              role: 'style_tag',
            },
            {
              productId: 42,
              variantId: 'v',
              requestedQuantity: 4,
              role: 'seat',
            },
          ],
        },
        favorites: ['a'],
      },
      0,
    ) as {
      sessionId: string
      project: { entry: string; items: unknown[] }
      journal: unknown[]
      discovery: unknown
    }
    expect(migrated.sessionId).toBe('session-ancienne')
    expect(migrated.project.entry).toBe('seats')
    expect(migrated.project.items).toEqual([
      { productId: 'a', variantId: 'v', role: 'seat', requestedQuantity: 1 },
    ])
    expect(migrated.journal).toEqual([])
    expect(migrated.discovery).toEqual({
      interactions: [],
      favoriteIds: [],
      finalistIds: [],
    })
    expect(migrated).not.toHaveProperty('favorites')
  })

  it('migre un état v1 (lot 1) : session et projet conservés, découverte vide, journal vidé', () => {
    const migrated = migrateStudioState(
      {
        sessionId: 'session-lot-1',
        project: {
          entry: 'full_project',
          items: [
            {
              productId: 'chair',
              variantId: 'std',
              requestedQuantity: 6,
              role: 'seat',
            },
          ],
          updatedAt: '2026-09-07T10:00:00.000Z',
        },
        journal: [
          {
            label: 'upsert_item',
            at: 'x',
            before: { entry: null, items: [], updatedAt: null },
          },
        ],
      },
      1,
    ) as {
      sessionId: string
      project: { items: unknown[]; updatedAt: string }
      journal: unknown[]
      discovery: unknown
    }
    expect(migrated.sessionId).toBe('session-lot-1')
    expect(migrated.project.items).toEqual([
      {
        productId: 'chair',
        variantId: 'std',
        role: 'seat',
        requestedQuantity: 6,
      },
    ])
    expect(migrated.project.updatedAt).toBe('2026-09-07T10:00:00.000Z')
    expect(migrated.journal).toEqual([])
    expect(migrated.discovery).toEqual({
      interactions: [],
      favoriteIds: [],
      finalistIds: [],
    })
  })

  it('un état v2 persisté est validé (finalistes plafonnés, favoris dédoublonnés)', () => {
    const migrated = migrateStudioState(
      {
        sessionId: 's',
        project: { entry: null, items: [], updatedAt: null },
        discovery: {
          interactions: [
            { productId: 'a', action: 'like', at: 't' },
            { productId: 'b', action: 'bizarre' },
          ],
          favoriteIds: ['a', 'a', 7],
          finalistIds: ['a', 'b', 'c', 'd'],
        },
        journal: [],
      },
      2,
    ) as {
      discovery: {
        interactions: unknown[]
        favoriteIds: string[]
        finalistIds: string[]
      }
    }
    expect(migrated.discovery.interactions).toEqual([
      { productId: 'a', action: 'like', at: 't' },
    ])
    expect(migrated.discovery.favoriteIds).toEqual(['a'])
    expect(migrated.discovery.finalistIds).toEqual(['a', 'b', 'c'])
  })

  it('génère une session si l’état persisté n’en a pas', () => {
    const migrated = migrateStudioState({}, 0) as { sessionId: string }
    expect(migrated.sessionId.length).toBeGreaterThan(8)
  })
})

describe('store Studio (découverte, lot 2)', () => {
  beforeEach(() => {
    localStorage.clear()
    useStudioStore.getState().resetSession()
  })

  it("j'aime ajoute aux favoris, pas pour moi retire, passer ne touche pas aux favoris", () => {
    const store = useStudioStore.getState()
    store.decide('a', 'like')
    store.decide('b', 'pass')
    store.decide('c', 'like')
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual(['a', 'c'])
    expect(
      useStudioStore
        .getState()
        .discovery.interactions.map((i) => [i.productId, i.action]),
    ).toEqual([
      ['a', 'like'],
      ['b', 'pass'],
      ['c', 'like'],
    ])
    store.decide('a', 'dislike')
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual(['c'])
  })

  it('Undo d’une décision restaure interactions ET favoris, exactement', () => {
    const store = useStudioStore.getState()
    store.decide('a', 'like')
    store.decide('b', 'dislike')
    expect(useStudioStore.getState().lastActionLabel()).toBe('decide')
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().discovery.interactions).toHaveLength(1)
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual(['a'])
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().discovery.interactions).toHaveLength(0)
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual([])
  })

  it('favoris ≠ projet : un favori ne crée jamais de ligne de projet', () => {
    const store = useStudioStore.getState()
    store.decide('a', 'like')
    store.addFavorite('b')
    expect(useStudioStore.getState().project.items).toHaveLength(0)
    store.removeFavorite('a')
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual(['b'])
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual(['a', 'b'])
  })

  it('finalistes : jamais plus de 3 sélectionnés, ajout refusé au-delà, remplacement et retrait', () => {
    const store = useStudioStore.getState()
    store.setFinalists(['a', 'b', 'c', 'd'])
    expect(useStudioStore.getState().discovery.finalistIds).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(store.addFinalist('e')).toBe(false)
    expect(useStudioStore.getState().discovery.finalistIds).toEqual([
      'a',
      'b',
      'c',
    ])
    store.replaceFinalist('b', 'e')
    expect(useStudioStore.getState().discovery.finalistIds).toEqual([
      'a',
      'e',
      'c',
    ])
    store.removeFinalist('a')
    expect(useStudioStore.getState().discovery.finalistIds).toEqual(['e', 'c'])
    expect(store.addFinalist('f')).toBe(true)
    expect(useStudioStore.getState().discovery.finalistIds).toEqual([
      'e',
      'c',
      'f',
    ])
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().discovery.finalistIds).toEqual(['e', 'c'])
  })

  it('retirer un favori le retire aussi des finalistes', () => {
    const store = useStudioStore.getState()
    store.addFavorite('a')
    store.setFinalists(['a'])
    store.removeFavorite('a')
    expect(useStudioStore.getState().discovery.finalistIds).toEqual([])
  })

  it('Undo mélangé projet / découverte : chaque retour est exact', () => {
    const store = useStudioStore.getState()
    store.decide('a', 'like')
    store.upsertItem({
      productId: 'a',
      variantId: 'v',
      requestedQuantity: 6,
      role: 'seat',
    })
    store.decide('b', 'pass')
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().discovery.interactions).toHaveLength(1)
    expect(useStudioStore.getState().project.items).toHaveLength(1)
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().project.items).toHaveLength(0)
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual(['a'])
    expect(useStudioStore.getState().undo()).toBe(true)
    expect(useStudioStore.getState().discovery.favoriteIds).toEqual([])
    expect(useStudioStore.getState().undo()).toBe(false)
  })

  it('la découverte est persistée et survit à un rechargement du store', () => {
    useStudioStore.getState().decide('a', 'like')
    const persisted = JSON.parse(
      localStorage.getItem(STUDIO_STORE_KEY) ?? '{}',
    ) as {
      state: { discovery: { favoriteIds: string[] } }
    }
    expect(persisted.state.discovery.favoriteIds).toEqual(['a'])
  })
})

describe('Lot 3 : version de session persistée', () => {
  it('attribue une seule fois ; Undo et rechargement conservent la version', async () => {
    useStudioStore.getState().resetSession()
    useStudioStore.getState().initializeAlgorithm('v1.0')
    useStudioStore.getState().decide('a', 'like')
    useStudioStore.getState().initializeAlgorithm('v0.1')
    useStudioStore.getState().undo()
    expect(useStudioStore.getState().algorithmVersion).toBe('v1.0')
    await useStudioStore.persist.rehydrate()
    expect(useStudioStore.getState().algorithmVersion).toBe('v1.0')
  })
  it('migration v2 conserve découverte et snapshots, attribue V0 historique', () => {
    const raw = {
      sessionId: 'legacy-session',
      project: { entry: 'seats', items: [], updatedAt: null },
      discovery: {
        interactions: [{ productId: 'a', action: 'like', at: '' }],
        favoriteIds: ['a'],
        finalistIds: [],
      },
      journal: [
        {
          label: 'decide',
          at: '',
          before: {
            project: { entry: 'seats', items: [], updatedAt: null },
            discovery: { interactions: [], favoriteIds: [], finalistIds: [] },
          },
        },
      ],
    }
    expect(migrateStudioState(raw, 2)).toEqual({
      ...raw,
      algorithmVersion: 'v0.1',
    })
  })
})
