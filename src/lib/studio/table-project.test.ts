import { beforeEach, describe, it, expect } from 'vitest'
import { top, base, data } from './table.test-helpers'
import { item } from './fixtures.test-helpers'
import { suggestTableQuantity } from './table-suggestion'
import {
  evaluateTable,
  sanitizeTables,
  type TableConfiguration,
} from './table-project'
import { useStudioStore, migrateStudioState } from '@/stores/studio.store'
const config: TableConfiguration = {
  id: 'table1',
  top: { productId: top.id, variantId: top.variants[0]!.id },
  base: { productId: base.id, variantId: base.variants[0]!.id },
  quantity: 30,
  quantityEdited: false,
  custom: null,
  verificationRequested: false,
  baseInvalidated: false,
}
describe('tables dans le projet', () => {
  beforeEach(() => {
    localStorage.clear()
    useStudioStore.getState().resetSession()
  })
  it.each([
    [60, 30],
    [61, 31],
    [1, 1],
    [0, 1],
  ])('suggestion %s assises = %s tables', (seats, tables) =>
    expect(suggestTableQuantity([item('s', seats)])).toBe(tables),
  )
  it('aucune assise = 1 ; les lignes techniques ne comptent pas', () =>
    expect(suggestTableQuantity([item('top', 60, { role: 'tabletop' })])).toBe(
      1,
    ))
  it('préserve quantité libre, association et Undo exact', () => {
    const store = useStudioStore.getState()
    store.initializeAlgorithm('v1.0')
    store.saveTable(config, [top, base], data)
    const before = useStudioStore.getState().project
    store.saveTable(
      { ...config, quantity: 17, quantityEdited: true },
      [top, base],
      data,
    )
    store.upsertItem(item('seat', 100))
    expect(useStudioStore.getState().project.tables?.[0]?.quantity).toBe(17)
    store.undo()
    store.undo()
    expect(useStudioStore.getState().project).toEqual(before)
    expect(useStudioStore.getState().algorithmVersion).toBe('v1.0')
    store.removeTable(config.id)
    expect(useStudioStore.getState().project.tables).toEqual([])
    store.undo()
    expect(useStudioStore.getState().project).toEqual(before)
  })
  it('changer de plateau retire la base incompatible et Undo la restaure', () => {
    const store = useStudioStore.getState()
    store.saveTable(config, [top, base], data)
    const second = { ...top, id: 'second' }
    store.saveTable(
      {
        ...config,
        top: { productId: second.id, variantId: second.variants[0]!.id },
      },
      [top, second, base],
      data,
    )
    expect(useStudioStore.getState().project.tables?.[0]).toMatchObject({
      base: null,
      baseInvalidated: true,
    })
    store.undo()
    expect(useStudioStore.getState().project.tables?.[0]?.base).toEqual(
      config.base,
    )
  })
  it('relire une configuration ne fait pas confiance à une base persistée', () => {
    const evaluation = evaluateTable(
      config,
      new Map([top, base].map((p) => [p.id, p])),
      { ...data, rules: [] },
      { stock: [], options: [] },
    )
    expect(evaluation.compatible).toBe(false)
    expect(evaluation.total).toBeNull()
    expect(evaluation.reasons).toContain('compatibility_unconfirmed')
  })
  it('migre v3 en préservant interactions, version, favoris et journal', () => {
    const store = useStudioStore.getState()
    store.initializeAlgorithm('v1.0')
    store.setEntry('full_project')
    store.upsertItem(item('s', 60))
    const old = useStudioStore.getState()
    const migrated = migrateStudioState(old, 3)
    expect(migrated).toMatchObject({
      sessionId: old.sessionId,
      algorithmVersion: 'v1.0',
      discovery: old.discovery,
      project: { items: old.project.items, tables: [] },
    })
    expect(migrated).toMatchObject({ journal: old.journal })
  })
  it('une session v3 non attribuée reste non attribuée', () => {
    expect(
      migrateStudioState(
        {
          sessionId: 'unassigned-session',
          algorithmVersion: null,
          project: { items: [] },
          discovery: {},
        },
        3,
      ),
    ).toMatchObject({ algorithmVersion: null })
  })
  it('rejette configurations corrompues, doublons et double source', () => {
    expect(
      sanitizeTables([
        config,
        config,
        {
          ...config,
          id: 'bad',
          custom: { shape: 'round', length: 70, width: 70, finish: '' },
        },
      ]),
    ).toEqual([config])
  })
})
