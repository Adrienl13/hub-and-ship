import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Verrouille le parcours « premier clic » : un visiteur dont la session vient
// de s'ouvrir doit pouvoir créer son espace en une fois, et un visiteur sans
// session doit retrouver un chemin vers un nouveau lien — jamais un spinner.

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unconfigured'

const search: { returnTo?: string; edit?: string } = {}
const auth: {
  status: AuthStatus
  user: {
    id: string
    email: string
    user_metadata: Record<string, unknown>
  } | null
} = { status: 'anonymous', user: null }

const updateUserMetadata = vi.fn()
const loadMyProfile = vi.fn()
const updateMyProfile = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  // Le fichier de route ne fait qu'enregistrer la page : on lui rend un
  // objet équivalent, dont `useSearch` lit l'état du test.
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    status: auth.status,
    user: auth.user,
    isConfigured: true,
    updateUserMetadata: (...args: unknown[]) => updateUserMetadata(...args),
  }),
}))

vi.mock('@/lib/account/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/account/profile')>()
  return {
    ...actual,
    loadMyProfile: (...args: unknown[]) => loadMyProfile(...args),
    updateMyProfile: (...args: unknown[]) => updateMyProfile(...args),
  }
})

vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({
    isConfigured: true,
    url: 'https://test.supabase.co',
    anonKey: 'test',
    missing: [],
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

import { Route } from './account.bienvenue'

// Avec le routeur simulé, `Route` est l'objet d'options : `component` y est.
const Page = (Route as unknown as { component: () => ReactNode }).component

const USER = {
  id: 'user-1',
  email: 'camille@hotel-des-pins.fr',
  user_metadata: {},
}

function stubLocation() {
  const assign = vi.fn()
  const replace = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign, replace, pathname: '/account/bienvenue', search: '' },
  })
  return { assign, replace }
}

beforeEach(() => {
  search.returnTo = undefined
  search.edit = undefined
  auth.status = 'anonymous'
  auth.user = null
  updateUserMetadata.mockReset().mockResolvedValue({ ok: true, message: '' })
  loadMyProfile.mockReset().mockResolvedValue({
    firstName: '',
    lastName: '',
    phone: '',
    marketingConsent: false,
  })
  updateMyProfile.mockReset().mockResolvedValue(undefined)
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('/account/bienvenue', () => {
  it('propose un nouveau lien quand la session est fermée', () => {
    search.returnTo = '/panier'
    render(<Page />)

    expect(
      screen.getByText('Votre lien a expiré ou la session est fermée.'),
    ).toBeInTheDocument()
    const retry = screen.getByRole('link', { name: 'Recevoir un nouveau lien' })
    // Le nouveau lien ramène ici, et la destination finale est conservée.
    expect(retry).toHaveAttribute(
      'href',
      '/auth/login?returnTo=' +
        encodeURIComponent('/account/bienvenue?returnTo=%2Fpanier'),
    )
  })

  it('affiche l’ouverture de l’espace pendant le chargement', () => {
    auth.status = 'loading'
    render(<Page />)
    expect(screen.getByText('Ouverture de votre espace…')).toBeInTheDocument()
  })

  it('préremplit la fiche et l’établissement connu', async () => {
    auth.status = 'authenticated'
    auth.user = { ...USER, user_metadata: { company_name: 'Hôtel des Pins' } }
    loadMyProfile.mockResolvedValue({
      firstName: 'Camille',
      lastName: '',
      phone: '',
      marketingConsent: false,
    })
    render(<Page />)

    expect(await screen.findByLabelText(/Prénom/)).toHaveValue('Camille')
    expect(screen.getByLabelText(/Établissement/)).toHaveValue('Hôtel des Pins')
    expect(screen.getByText(USER.email)).toBeInTheDocument()
    expect(loadMyProfile).toHaveBeenCalledWith({}, 'user-1')
  })

  it('passe directement à la destination quand la fiche est déjà complète', async () => {
    const { replace } = stubLocation()
    auth.status = 'authenticated'
    auth.user = { ...USER, user_metadata: { company_name: 'Hôtel des Pins' } }
    loadMyProfile.mockResolvedValue({
      firstName: 'Camille',
      lastName: 'Martin',
      phone: '',
      marketingConsent: false,
    })
    search.returnTo = '/panier'
    render(<Page />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panier'))
    expect(screen.queryByLabelText(/Prénom/)).toBeNull()
  })

  it('garde la saisie quand la session est réémise (nouvel objet user, même id)', async () => {
    auth.status = 'authenticated'
    auth.user = USER
    const view = render(<Page />)

    fireEvent.change(await screen.findByLabelText(/Prénom/), {
      target: { value: 'Camille' },
    })
    // Retour d'onglet, jeton rafraîchi : Supabase réémet la session, l'objet
    // `user` change d'identité. La fiche ne doit pas être relue ni écrasée.
    auth.user = { ...USER, user_metadata: { ...USER.user_metadata } }
    view.rerender(<Page />)

    expect(screen.getByLabelText(/Prénom/)).toHaveValue('Camille')
    expect(loadMyProfile).toHaveBeenCalledTimes(1)
  })

  it('laisse modifier une fiche complète avec ?edit=1', async () => {
    const { replace } = stubLocation()
    auth.status = 'authenticated'
    auth.user = { ...USER, user_metadata: { company_name: 'Hôtel des Pins' } }
    loadMyProfile.mockResolvedValue({
      firstName: 'Camille',
      lastName: 'Martin',
      phone: '',
      marketingConsent: false,
    })
    search.edit = '1'
    render(<Page />)

    expect(await screen.findByLabelText(/Nom/)).toHaveValue('Martin')
    expect(replace).not.toHaveBeenCalled()
  })

  it('bloque un formulaire vide sans rien enregistrer', async () => {
    auth.status = 'authenticated'
    auth.user = USER
    render(<Page />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Créer mon espace' }),
    )

    expect(screen.getByText('Indiquez votre prénom.')).toBeInTheDocument()
    expect(screen.getByText('Indiquez votre nom.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Le nom de votre établissement nous aide à préparer vos devis.',
      ),
    ).toBeInTheDocument()
    expect(updateMyProfile).not.toHaveBeenCalled()
    expect(updateUserMetadata).not.toHaveBeenCalled()
  })

  it('enregistre la fiche, les métadonnées, puis ouvre la destination', async () => {
    const { assign } = stubLocation()
    auth.status = 'authenticated'
    auth.user = USER
    search.returnTo = '/panier'
    render(<Page />)

    fireEvent.change(await screen.findByLabelText(/Prénom/), {
      target: { value: 'Camille' },
    })
    fireEvent.change(screen.getByLabelText(/Nom/), {
      target: { value: 'Martin' },
    })
    fireEvent.change(screen.getByLabelText(/Établissement/), {
      target: { value: ' Hôtel des Pins ' },
    })
    fireEvent.change(screen.getByLabelText(/Téléphone/), {
      target: { value: '06 12 34 56 78' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon espace' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/panier'))

    expect(updateMyProfile).toHaveBeenCalledTimes(1)
    const [, userId, patch] = updateMyProfile.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ]
    expect(userId).toBe('user-1')
    expect(patch).toMatchObject({
      first_name: 'Camille',
      last_name: 'Martin',
      phone: '06 12 34 56 78',
      email_marketing_consent: false,
    })

    expect(updateUserMetadata).toHaveBeenCalledTimes(1)
    expect(updateUserMetadata.mock.calls[0]?.[0]).toMatchObject({
      first_name: 'Camille',
      last_name: 'Martin',
      company_name: 'Hôtel des Pins',
      phone: '06 12 34 56 78',
    })
    expect(toastSuccess).toHaveBeenCalledWith('Votre espace est prêt.')
  })

  it('ne redirige jamais vers la page elle-même', async () => {
    const { assign } = stubLocation()
    auth.status = 'authenticated'
    auth.user = USER
    search.returnTo = '/account/bienvenue?returnTo=%2Fpanier'
    render(<Page />)

    fireEvent.change(await screen.findByLabelText(/Prénom/), {
      target: { value: 'Camille' },
    })
    fireEvent.change(screen.getByLabelText(/Nom/), {
      target: { value: 'Martin' },
    })
    fireEvent.change(screen.getByLabelText(/Établissement/), {
      target: { value: 'Hôtel des Pins' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon espace' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/account'))
  })

  it('signale une erreur d’enregistrement et laisse réessayer', async () => {
    const { assign } = stubLocation()
    auth.status = 'authenticated'
    auth.user = USER
    updateMyProfile.mockRejectedValue(new Error('RLS refusée'))
    render(<Page />)

    fireEvent.change(await screen.findByLabelText(/Prénom/), {
      target: { value: 'Camille' },
    })
    fireEvent.change(screen.getByLabelText(/Nom/), {
      target: { value: 'Martin' },
    })
    fireEvent.change(screen.getByLabelText(/Établissement/), {
      target: { value: 'Hôtel des Pins' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon espace' }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Enregistrement impossible : RLS refusée',
      ),
    )
    expect(updateUserMetadata).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Créer mon espace' }),
    ).toBeEnabled()
  })
})
