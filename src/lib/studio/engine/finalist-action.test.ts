import { expect, it } from 'vitest'
import { useStudioStore } from '@/stores/studio.store'
import { emptyAffinity, finalistCandidateAction } from './scoring'
import type { EngineSeat } from './types'

it.each([-1, 0, 1])('deux finalistes + score %s respecte la troisième place', (score) => {
  useStudioStore.getState().resetSession()
  useStudioStore.getState().setFinalists(['a', 'b'])
  const candidate: EngineSeat = { id: 'c', material: 'rope', seatKind: null, familyId: null }
  const seats = new Map([['c', candidate]])
  const affinity = { ...emptyAffinity(), material: new Map([['rope', score]]) }
  const action = finalistCandidateAction('c', useStudioStore.getState().discovery.finalistIds, affinity, seats)
  expect(action).toBe(score > 0 ? 'add' : 'compare')
  if (action === 'add') useStudioStore.getState().addFinalist('c')
  expect(useStudioStore.getState().discovery.finalistIds).toHaveLength(score > 0 ? 3 : 2)
})

it('remplacement à trois autorisé même sans affinité, jamais plus de trois', () => {
  useStudioStore.getState().resetSession()
  useStudioStore.getState().setFinalists(['a', 'b', 'c'])
  const seats = new Map<string, EngineSeat>([['d', { id: 'd', material: null, seatKind: null, familyId: null }]])
  expect(finalistCandidateAction('d', ['a', 'b', 'c'], emptyAffinity(), seats)).toBe('replace')
  expect(useStudioStore.getState().addFinalist('d')).toBe(false)
  useStudioStore.getState().replaceFinalist('c', 'd')
  expect(useStudioStore.getState().discovery.finalistIds).toEqual(['a', 'b', 'd'])
  expect(finalistCandidateAction('unknown', ['a', 'b'], emptyAffinity(), seats)).toBe('compare')
})
