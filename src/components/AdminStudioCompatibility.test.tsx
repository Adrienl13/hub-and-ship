import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { AdminStudioCompatibility } from './AdminStudioCompatibility'
import type { AdminClient } from './AdminStudioTab'
import { top, base } from '@/lib/studio/table.test-helpers'
vi.mock('@/lib/studio/repository', () => ({
  fetchStudioCatalog: async () => ({ products: [top, base] }),
}))
vi.mock('@/lib/studio/table-repository', () => ({
  fetchTableCompatibility: async () => ({
    available: true,
    rules: [],
    baseProfiles: [],
  }),
}))
it('validation explicite avec provenance, sans identité fournie par le navigateur', async () => {
  const insert = vi.fn(async () => ({ data: [], error: null }))
  const client = {
    from: () => ({
      select: () => ({ range: async () => ({ data: [], error: null }) }),
      insert,
    }),
  } as unknown as AdminClient
  render(<AdminStudioCompatibility client={client} />)
  await screen.findByLabelText('Plateau')
  fireEvent.change(screen.getByLabelText('Plateau'), {
    target: { value: top.id },
  })
  fireEvent.change(screen.getByLabelText('Piètement'), {
    target: { value: base.id },
  })
  expect(
    screen.getByRole('button', { name: 'Enregistrer la validation' }),
  ).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Provenance de la validation'), {
    target: { value: 'Fiche fabricant contrôlée' },
  })
  fireEvent.change(screen.getByLabelText('Verdict'), {
    target: { value: 'denied' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer la validation' }),
  )
  await waitFor(() =>
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        base_id: base.id,
        tabletop_id: top.id,
        status: 'verified',
        verdict: 'denied',
        provenance: 'Fiche fabricant contrôlée',
      }),
    ),
  )
  expect(insert.mock.calls[0]).not.toEqual(
    expect.objectContaining({ verified_by: expect.anything() }),
  )
})
it('migration absente annoncée sans casser le reste du panneau', async () => {
  const client = {
    from: () => ({
      select: () => ({
        range: async () => ({ data: [], error: { message: 'missing' } }),
      }),
    }),
  } as unknown as AdminClient
  render(<AdminStudioCompatibility client={client} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('migration Lot 4')
  expect(
    screen.queryByRole('button', { name: 'Enregistrer la validation' }),
  ).toBeNull()
})
