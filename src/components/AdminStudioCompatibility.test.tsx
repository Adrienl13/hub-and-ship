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

it('saisie facultative des quatre bornes et rejet des plages incohérentes', async () => {
  const insert = vi.fn(async () => ({ data: [], error: null }))
  const client = {
    from: (table: string) => ({
      select: () => ({
        range: async () => ({
          data:
            table === 'studio_table_base_types'
              ? [{ id: 'central', label: 'Central' }]
              : [],
          error: null,
        }),
      }),
      insert,
    }),
  } as unknown as AdminClient
  render(<AdminStudioCompatibility client={client} />)
  await screen.findByLabelText('Portée')
  fireEvent.change(screen.getByLabelText('Portée'), {
    target: { value: 'type' },
  })
  fireEvent.change(screen.getByLabelText('Type'), {
    target: { value: 'central' },
  })
  fireEvent.change(screen.getByLabelText('Provenance de la validation'), {
    target: { value: 'Fiche vérifiée' },
  })
  const button = screen.getByRole('button', {
    name: 'Enregistrer la validation',
  })
  for (const [label, value] of [
    ['Longueur minimale (cm)', '50'],
    ['Largeur minimale (cm)', '50'],
    ['Longueur maximale (cm)', '80'],
    ['Largeur maximale (cm)', '80'],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } })
  expect(button).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Longueur minimale (cm)'), {
    target: { value: '90' },
  })
  expect(button).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Longueur minimale (cm)'), {
    target: { value: '50' },
  })
  fireEvent.click(button)
  await waitFor(() =>
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        min_length_cm: 50,
        min_width_cm: 50,
        max_length_cm: 80,
        max_width_cm: 80,
      }),
    ),
  )
  await waitFor(() => expect(button).toBeEnabled())
  for (const label of [
    'Longueur maximale (cm)',
    'Largeur maximale (cm)',
    'Largeur minimale (cm)',
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } })
  fireEvent.click(button)
  await waitFor(() =>
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        min_length_cm: 50,
        min_width_cm: null,
        max_length_cm: null,
        max_width_cm: null,
      }),
    ),
  )
})
