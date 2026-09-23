import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Verrouille le choix du mot de passe : réservé aux connectés (sinon un
// chemin vers un nouveau lien), confirmation exigée, enregistrement puis
// retour au tableau de bord.
//
// Le hook useAuth est réel : c'est le client d'authentification qui est
// simulé, pour vérifier l'appel `updateUser` tel qu'il part vraiment.

const search: { change?: string } = {}

const getUser = vi.fn()
const updateUser = vi.fn()
const navigate = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  useNavigate:
    () =>
    (...args: unknown[]) =>
      navigate(...args),
  Link: ({
    children,
    to,
    search: linkSearch,
    ...rest
  }: {
    children: ReactNode
    to: string
    search?: Record<string, string | undefined>
  }) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(linkSearch ?? {})) {
      if (value !== undefined) params.set(key, value)
    }
    const query = params.toString()
    return (
      <a href={query ? `${to}?${query}` : to} {...rest}>
        {children}
      </a>
    )
  },
}))

vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({
    isConfigured: true,
    url: 'https://test.supabase.co',
    anonKey: 'test',
    appUrl: 'http://localhost:3000',
    missing: [],
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUser(...args),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

import { Route } from './account.mot-de-passe'

const Page = (Route as unknown as { component: () => ReactNode }).component

const USER = {
  id: 'user-1',
  email: 'camille@hotel-des-pins.fr',
  user_metadata: {},
}

function stubLocation() {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      assign,
      replace: vi.fn(),
      origin: 'http://localhost:3000',
      pathname: '/account/mot-de-passe',
      search: '',
      hash: '',
    },
  })
  return { assign }
}

async function fillPasswords(password: string, confirmation: string) {
  fireEvent.change(await screen.findByLabelText(/^Nouveau mot de passe/), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText(/^Confirmez le mot de passe/), {
    target: { value: confirmation },
  })
}

function submit() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Enregistrer mon mot de passe' }),
  )
}

beforeEach(() => {
  search.change = undefined
  getUser.mockReset().mockResolvedValue({ data: { user: USER } })
  updateUser
    .mockReset()
    .mockResolvedValue({ data: { user: USER }, error: null })
  toastSuccess.mockReset()
  navigate.mockReset().mockResolvedValue(undefined)
  toastError.mockReset()
})

describe('/account/mot-de-passe', () => {
  it('propose un nouveau lien quand la session est fermée', async () => {
    stubLocation()
    getUser.mockResolvedValue({ data: { user: null } })
    render(<Page />)

    expect(await screen.findByText('Session fermée.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Demander un nouveau lien' }),
    ).toHaveAttribute('href', '/auth/mot-de-passe-oublie')
    expect(screen.queryByLabelText(/^Nouveau mot de passe/)).toBeNull()
  })

  it('titre « Choisissez » par défaut, « Changez » depuis les paramètres', async () => {
    stubLocation()
    const view = render(<Page />)
    expect(
      await screen.findByText('Choisissez votre mot de passe.'),
    ).toBeInTheDocument()
    expect(screen.getByText(USER.email)).toBeInTheDocument()
    view.unmount()

    search.change = '1'
    render(<Page />)
    expect(
      await screen.findByText('Changez votre mot de passe.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Revenir aux paramètres du compte' }),
    ).toHaveAttribute('href', '/account/parametres')
  })

  it('refuse une confirmation différente sans rien enregistrer', async () => {
    const { assign } = stubLocation()
    render(<Page />)

    await fillPasswords('Terrasse-2026', 'Terrasse-2025')
    submit()

    expect(
      screen.getByText('Les deux mots de passe ne sont pas identiques.'),
    ).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe trop court', async () => {
    stubLocation()
    render(<Page />)

    await fillPasswords('court', 'court')
    submit()

    expect(
      screen.getByText(
        'Votre mot de passe doit contenir au moins 8 caractères.',
      ),
    ).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('enregistre le mot de passe puis ouvre le tableau de bord', async () => {
    stubLocation()
    render(<Page />)

    await fillPasswords('Terrasse-2026', 'Terrasse-2026')
    submit()

    // Navigation dans l'application (pas de rechargement) : le toast survit.
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/account' }),
    )
    expect(updateUser).toHaveBeenCalledWith({ password: 'Terrasse-2026' })
    expect(toastSuccess).toHaveBeenCalledWith('Mot de passe enregistré.')
  })

  it('traduit un refus du service et laisse réessayer', async () => {
    const { assign } = stubLocation()
    updateUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'New password should be different from the old password.',
        code: 'same_password',
      },
    })
    render(<Page />)

    await fillPasswords('Terrasse-2026', 'Terrasse-2026')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choisissez un mot de passe différent de l’actuel.',
    )
    expect(assign).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Enregistrer mon mot de passe' }),
    ).toBeEnabled()
  })
})
