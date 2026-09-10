import { it, expect } from 'vitest'
import { useStudioStore, migrateStudioState } from './studio.store'
import { lineTargets } from '@/lib/studio/customization'
it('persistance, reload, Undo et reset des demandes sans statut client', async () => {
  const store = () => useStudioStore.getState()
  store().resetSession()
  const target = lineTargets('line', 5, { seat: 'p' })[1]!
  store().setCustomization(target, [
    { kind: 'rope_color', note: 'Bleu souhaité', value: '', requested: false },
  ])
  await useStudioStore.persist.rehydrate()
  expect(store().project.customization?.[target.key]?.[0]?.note).toBe(
    'Bleu souhaité',
  )
  store().undo()
  expect(store().project.customization).toBeUndefined()
  store().setCustomization(target, [
    { kind: 'rope_color', note: 'test', value: '', requested: false },
  ])
  store().clearProject()
  expect(store().project.customization).toBeUndefined()
})
it('migration v4 conserve les sélections historiques et ignore des options malformées', () => {
  const result = migrateStudioState(
    {
      sessionId: 's',
      project: {
        items: [],
        tables: [],
        customization: { k: [{ kind: 'invalid' }, null] },
      },
      discovery: {},
    },
    4,
  ) as { project: { customization: unknown } }
  expect(result.project.customization).toEqual({ k: [] })
})

it('une session sans brouillon reste libre de choisir V1 après réhydratation', async () => {
  useStudioStore.getState().resetSession()
  localStorage.removeItem('terrassea-studio-v1')
  await useStudioStore.persist.rehydrate()
  expect(useStudioStore.getState().algorithmVersion).toBeNull()
  useStudioStore.getState().initializeAlgorithm('v1.0')
  expect(useStudioStore.getState().algorithmVersion).toBe('v1.0')
})
