import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, it, expect, beforeEach } from 'vitest'
import { AdminShowroomTab } from './AdminShowroomTab'
const { upsert, load } = vi.hoisted(() => ({ upsert: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/showroom', async () => {
  const actual = await vi.importActual<object>('@/lib/showroom')
  return {
    ...actual,
    showroomClient: () => ({
      db: { from: () => ({ select: () => ({ order: load }), upsert }) },
      storage: {
        from: () => ({ createSignedUrls: async () => ({ data: [] }) }),
      },
    }),
  }
})
vi.mock('@/components/showroom/LocationMap', () => ({
  default: ({
    onPosition,
  }: {
    onPosition: (lat: number, lng: number) => void
  }) => (
    <button type="button" onClick={() => onPosition(45.75, 4.85)}>
      Choisir ce point
    </button>
  ),
}))
vi.mock('@/components/showroom/CommuneSearch', () => ({
  CommuneSearch: ({ onChoose }: { onChoose: (v: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChoose({
          nom: 'Lyon',
          codesPostaux: ['69002'],
          centre: { coordinates: [4.85, 45.75] },
        })
      }
    >
      Choisir Lyon
    </button>
  ),
}))
beforeEach(() => {
  vi.clearAllMocks()
  load.mockResolvedValue({ data: [], error: null })
  upsert.mockResolvedValue({ error: null })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ products: [] }) }),
  )
})
it('shows missing commune beside save and retains inputs after a server refusal', async () => {
  render(<AdminShowroomTab />)
  const name = await screen.findByLabelText('Nom de l’établissement')
  fireEvent.change(name, { target: { value: 'Mon établissement' } })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  const feedback = await screen.findByText(
    'Recherchez la commune puis sélectionnez un résultat dans la liste.',
  )
  expect(feedback.parentElement?.tagName).toBe('FORM')
  expect(upsert).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Choisir Lyon'))
  upsert.mockResolvedValueOnce({ error: { message: 'Denied' } })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await screen.findByText(/Enregistrement impossible/)
  expect(name).toHaveValue('Mon établissement')
  expect(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  ).toBeEnabled()
})
it('saves an internal venue before photos, and prevents publishing without consent', async () => {
  render(<AdminShowroomTab />)
  await screen.findByLabelText('Nom de l’établissement')
  fireEvent.change(screen.getByLabelText('Nom de l’établissement'), {
    target: { value: 'Lieu test' },
  })
  fireEvent.click(screen.getByText('Choisir Lyon'))
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await waitFor(() =>
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lieu test',
        visibility: 'internal',
        photo_paths: [],
      }),
    ),
  )
  fireEvent.change(screen.getByLabelText('Visibilité'), {
    target: { value: 'on_request' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await screen.findByText(
    'Enregistrez l’accord de publication et sa référence.',
  )
  expect(upsert).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByLabelText(/L’établissement accepte/))
  fireEvent.change(screen.getByLabelText(/Référence de l’accord/), {
    target: { value: 'Accord test' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer les modifications' }),
  )
  await waitFor(() =>
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visibility: 'on_request',
        publication_agreed: true,
        consent_note: 'Accord test',
      }),
    ),
  )
  await screen.findByText(/Lieu enregistré et publié/)
  fireEvent.click(screen.getByLabelText(/L’établissement accepte/))
  expect(screen.getByLabelText('Visibilité')).toHaveValue('internal')
})
it('shows a real error and no save form when the migration is absent', async () => {
  load.mockResolvedValue({ data: null, error: { message: 'relation missing' } })
  render(<AdminShowroomTab />)
  await screen.findByText(/Vérifiez que la migration Showroom/)
  expect(
    screen.queryByRole('button', { name: 'Enregistrer le lieu' }),
  ).not.toBeInTheDocument()
})
