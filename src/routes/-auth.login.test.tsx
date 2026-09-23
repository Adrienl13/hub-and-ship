import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Verrouille la connexion par email + mot de passe : destination résolue
// comme au retour du lien par email, erreurs traduites, renvoi de l'email
// d'activation, et le lien par email toujours disponible en secours.
//
// Le hook useAuth est réel : c'est le client d'authentification qui est
// simulé, pour vérifier les appels tels qu'ils partent vraiment.

const search: { returnTo?: string } = {}

const signInWithPassword = vi.fn()
const signInWithOtp = vi.fn()
const resend = vi.fn()
const getUser = vi.fn()
const loadMyProfile = vi.fn()
const logEvent = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => search,
  }),
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

vi.mock('@/hooks/useSecurityEvents', () => ({
  useSecurityEvents: () => ({
    isConfigured: true,
    logEvent: (...args: unknown[]) => logEvent(...args),
  }),
}))

vi.mock('@/lib/account/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/account/profile')>()
  return {
    ...actual,
    loadMyProfile: (...args: unknown[]) => loadMyProfile(...args),
  }
})

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
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      resend: (...args: unknown[]) => resend(...args),
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

import { Route } from './auth.login'

const Page = (Route as unknown as { component: () => ReactNode }).component

const USER = {
  id: 'user-1',
  email: 'camille@hotel-des-pins.fr',
  user_metadata: { company_name: 'Hôtel des Pins' },
}

const COMPLETE_PROFILE = {
  firstName: 'Camille',
  lastName: 'Martin',
  phone: '',
  marketingConsent: false,
}

function stubLocation() {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      assign,
      replace: vi.fn(),
      origin: 'http://localhost:3000',
      pathname: '/auth/login',
      search: '',
      hash: '',
    },
  })
  return { assign }
}

async function submitPassword(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/Email professionnel/), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), {
    target: { value: password },
  })
  const button = screen.getByRole('button', { name: 'Se connecter' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}

beforeEach(() => {
  search.returnTo = undefined
  getUser.mockReset().mockResolvedValue({ data: { user: null } })
  signInWithPassword.mockReset()
  signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null })
  resend.mockReset().mockResolvedValue({ data: {}, error: null })
  loadMyProfile.mockReset().mockResolvedValue(COMPLETE_PROFILE)
  logEvent.mockReset().mockResolvedValue({ ok: true })
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('/auth/login — email + mot de passe', () => {
  it('désactive « Se connecter » tant que l’email est invalide ou le mot de passe vide', () => {
    stubLocation()
    render(<Page />)

    const button = screen.getByRole('button', { name: 'Se connecter' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Email professionnel/), {
      target: { value: 'camille@hotel-des-pins.fr' },
    })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^Mot de passe/), {
      target: { value: 'Terrasse-2026' },
    })
    expect(button).toBeEnabled()
  })

  it('permet d’afficher puis de masquer le mot de passe', () => {
    stubLocation()
    render(<Page />)

    const input = screen.getByLabelText(/^Mot de passe/)
    const toggle = screen.getByRole('button', {
      name: 'Afficher le mot de passe',
    })
    expect(input).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    // Le nom accessible reste stable : c'est aria-pressed qui porte l'état.
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveTextContent('Masquer')
  })

  it('ouvre le tableau de bord quand la fiche est complète', async () => {
    const { assign } = stubLocation()
    signInWithPassword.mockResolvedValue({
      data: { user: USER, session: {} },
      error: null,
    })
    render(<Page />)

    await submitPassword('camille@hotel-des-pins.fr', 'Terrasse-2026')

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/account'))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'camille@hotel-des-pins.fr',
      password: 'Terrasse-2026',
    })
    expect(loadMyProfile).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('passe par la création de l’espace quand la fiche est incomplète', async () => {
    const { assign } = stubLocation()
    signInWithPassword.mockResolvedValue({
      data: { user: { ...USER, user_metadata: {} }, session: {} },
      error: null,
    })
    loadMyProfile.mockResolvedValue({
      firstName: '',
      lastName: '',
      phone: '',
      marketingConsent: false,
    })
    render(<Page />)

    await submitPassword('nouveau@hotel-des-pins.fr', 'Terrasse-2026')

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        '/account/bienvenue?returnTo=%2Faccount',
      ),
    )
  })

  it('conserve la destination demandée', async () => {
    const { assign } = stubLocation()
    search.returnTo = '/panier'
    signInWithPassword.mockResolvedValue({
      data: { user: USER, session: {} },
      error: null,
    })
    render(<Page />)

    await submitPassword('panier@hotel-des-pins.fr', 'Terrasse-2026')

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/panier'))
  })

  it('traduit un mauvais mot de passe sans révéler le message technique', async () => {
    const { assign } = stubLocation()
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Invalid login credentials',
        code: 'invalid_credentials',
        status: 400,
      },
    })
    render(<Page />)

    await submitPassword('erreur@hotel-des-pins.fr', 'mauvais-mdp')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email ou mot de passe incorrect.',
    )
    expect(screen.queryByText(/Invalid login credentials/)).toBeNull()
    expect(assign).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
  })

  it('propose de renvoyer l’email d’activation quand l’espace n’est pas activé', async () => {
    stubLocation()
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
    })
    render(<Page />)

    await submitPassword('inactif@hotel-des-pins.fr', 'Terrasse-2026')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Activez d’abord votre espace : le lien est dans l’email reçu à l’inscription.',
    )
    fireEvent.click(
      screen.getByRole('button', { name: "Renvoyer l'email d'activation" }),
    )

    await waitFor(() =>
      expect(resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'inactif@hotel-des-pins.fr',
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?returnTo=%2Faccount',
        },
      }),
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      "Email d'activation renvoyé",
      expect.anything(),
    )
  })

  it('bloque après cinq tentatives sur la même adresse', async () => {
    stubLocation()
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })
    render(<Page />)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitPassword('limite@hotel-des-pins.fr', `essai-${attempt}`)
      await waitFor(() =>
        expect(signInWithPassword).toHaveBeenCalledTimes(attempt + 1),
      )
    }
    await submitPassword('limite@hotel-des-pins.fr', 'essai-final')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Trop de tentatives, réessayez dans/,
    )
    expect(signInWithPassword).toHaveBeenCalledTimes(5)
  })

  it('mène au mot de passe oublié avec l’adresse saisie, et à la création de l’espace', () => {
    stubLocation()
    search.returnTo = '/panier'
    render(<Page />)

    fireEvent.change(screen.getByLabelText(/Email professionnel/), {
      target: { value: 'camille@hotel-des-pins.fr' },
    })

    expect(
      screen.getByRole('link', { name: 'Mot de passe oublié ?' }),
    ).toHaveAttribute(
      'href',
      '/auth/mot-de-passe-oublie?email=camille%40hotel-des-pins.fr',
    )
    expect(
      screen.getByRole('link', { name: 'Créer mon espace' }),
    ).toHaveAttribute('href', '/auth/inscription?returnTo=%2Fpanier')
  })
})

describe('/auth/login — lien de connexion par email (secours)', () => {
  it('bascule vers le lien par email et envoie le lien avec la destination', async () => {
    stubLocation()
    search.returnTo = '/panier'
    render(<Page />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Recevoir un lien de connexion par email',
      }),
    )

    expect(screen.queryByLabelText(/^Mot de passe/)).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Revenir au mot de passe' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Email professionnel/), {
      target: { value: 'lien@hotel-des-pins.fr' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir mon lien' }))

    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: 'lien@hotel-des-pins.fr',
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?returnTo=%2Fpanier',
        },
      }),
    )
    expect(
      await screen.findByText(/Lien envoyé à lien@hotel-des-pins.fr/),
    ).toBeInTheDocument()
  })

  it('revient au mot de passe en gardant l’adresse saisie', () => {
    stubLocation()
    render(<Page />)

    fireEvent.change(screen.getByLabelText(/Email professionnel/), {
      target: { value: 'camille@hotel-des-pins.fr' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Recevoir un lien de connexion par email',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Revenir au mot de passe' }),
    )

    expect(screen.getByLabelText(/Email professionnel/)).toHaveValue(
      'camille@hotel-des-pins.fr',
    )
    expect(screen.getByLabelText(/^Mot de passe/)).toHaveValue('')
  })
})

describe('/auth/login — déjà connecté', () => {
  it('redirige sans rien demander', async () => {
    const { assign } = stubLocation()
    search.returnTo = '/panier'
    getUser.mockResolvedValue({ data: { user: USER } })
    render(<Page />)

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/panier'))
  })
})
