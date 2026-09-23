import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Verrouille la création de l'espace en une page : validation locale,
// inscription envoyée avec la fiche en métadonnées et le retour vers le
// callback, écran « Vérifiez votre boîte mail », réponse neutre quand
// l'adresse est déjà connue.
//
// Le hook useAuth est réel : c'est le client d'authentification qui est
// simulé, pour vérifier l'appel `signUp` tel qu'il part vraiment.

const search: { returnTo?: string } = {}

const signUp = vi.fn()
const resend = vi.fn()
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
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signUp: (...args: unknown[]) => signUp(...args),
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

import { Route } from './auth.inscription'

const Page = (Route as unknown as { component: () => ReactNode }).component

const EMAIL = 'camille@hotel-des-pins.fr'
const PASSWORD = 'Terrasse-2026'

function stubLocation() {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      assign,
      replace: vi.fn(),
      origin: 'http://localhost:3000',
      pathname: '/auth/inscription',
      search: '',
      hash: '',
    },
  })
  return { assign }
}

function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    Prénom: 'Camille',
    Nom: 'Martin',
    Établissement: ' Hôtel des Pins ',
    'Email professionnel': EMAIL,
    'Mot de passe': PASSWORD,
    Téléphone: '06 12 34 56 78',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), {
      target: { value },
    })
  }
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Créer mon espace' }))
}

beforeEach(() => {
  search.returnTo = undefined
  signUp.mockReset()
  resend.mockReset().mockResolvedValue({ data: {}, error: null })
  toastSuccess.mockReset()
  toastError.mockReset()
})

describe('/auth/inscription', () => {
  it('présente le formulaire complet et le lien vers la connexion', () => {
    stubLocation()
    search.returnTo = '/panier'
    render(<Page />)

    expect(screen.getByText('Créez votre espace pro.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Prénom/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nom/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Établissement/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email professionnel/)).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText(/^Mot de passe/)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByLabelText(/^Téléphone/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/auth/login?returnTo=%2Fpanier',
    )
  })

  it('bloque un formulaire vide sans rien envoyer', () => {
    stubLocation()
    render(<Page />)

    submit()

    expect(screen.getByText('Indiquez votre prénom.')).toBeInTheDocument()
    expect(screen.getByText('Indiquez votre nom.')).toBeInTheDocument()
    expect(
      screen.getByText('Indiquez votre email professionnel.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Choisissez un mot de passe.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe trop court et affiche la solidité pendant la saisie', () => {
    stubLocation()
    render(<Page />)

    fillForm({ 'Mot de passe': 'court' })
    expect(screen.getByText('Mot de passe faible')).toBeInTheDocument()
    submit()
    expect(
      screen.getByText(
        'Votre mot de passe doit contenir au moins 8 caractères.',
      ),
    ).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/^Mot de passe/), {
      target: { value: 'Terrasse-2026-Soleil' },
    })
    expect(screen.getByText('Mot de passe solide')).toBeInTheDocument()
  })

  it('crée l’espace avec la fiche en métadonnées puis invite à activer', async () => {
    stubLocation()
    search.returnTo = '/panier'
    signUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', identities: [{ id: 'identity-1' }] },
        session: null,
      },
      error: null,
    })
    render(<Page />)

    fillForm()
    submit()

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1))
    expect(signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: {
        data: {
          first_name: 'Camille',
          last_name: 'Martin',
          company_name: 'Hôtel des Pins',
          phone: '06 12 34 56 78',
          email_marketing_consent: false,
          onboarding_completed_at: expect.any(String),
        },
        emailRedirectTo:
          'http://localhost:3000/auth/callback?returnTo=%2Fpanier',
      },
    })

    expect(
      await screen.findByText('Vérifiez votre boîte mail.'),
    ).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByText(/Activer mon espace/)).toBeInTheDocument()
    expect(screen.queryByText(/déjà un espace/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer l’email' }))
    await waitFor(() =>
      expect(resend).toHaveBeenCalledWith({
        type: 'signup',
        email: EMAIL,
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?returnTo=%2Fpanier',
        },
      }),
    )
  })

  it('transmet le consentement coché', async () => {
    stubLocation()
    signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [{}] }, session: null },
      error: null,
    })
    render(<Page />)

    fillForm()
    fireEvent.click(screen.getByRole('checkbox'))
    submit()

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1))
    expect(signUp.mock.calls[0]?.[0]).toMatchObject({
      options: { data: { email_marketing_consent: true } },
    })
  })

  it('reste neutre quand l’adresse est déjà connue (utilisateur sans identité)', async () => {
    stubLocation()
    signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [] }, session: null },
      error: null,
    })
    render(<Page />)

    fillForm()
    submit()

    expect(
      await screen.findByText('Vérifiez votre boîte mail.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Si cette adresse a déjà un espace/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'connectez-vous' }),
    ).toHaveAttribute('href', '/auth/login?returnTo=%2Faccount')
    expect(
      screen.getByRole('link', { name: 'demandez un nouveau mot de passe' }),
    ).toHaveAttribute(
      'href',
      '/auth/mot-de-passe-oublie?email=camille%40hotel-des-pins.fr',
    )
  })

  it('ouvre directement l’espace quand la session est déjà ouverte', async () => {
    const { assign } = stubLocation()
    search.returnTo = '/panier'
    signUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [{}] }, session: {} },
      error: null,
    })
    render(<Page />)

    fillForm()
    submit()

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/panier'))
  })

  it('renvoie vers la connexion quand le service signale une adresse déjà inscrite', async () => {
    stubLocation()
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'User already registered',
        code: 'user_already_exists',
      },
    })
    render(<Page />)

    fillForm()
    submit()

    expect(
      await screen.findByText(
        'Cette adresse a déjà un espace : connectez-vous.',
      ),
    ).toBeInTheDocument()
    // Un lien sous le champ email, en plus de celui du pied de page.
    const loginLinks = screen.getAllByRole('link', { name: 'Se connecter' })
    expect(loginLinks).toHaveLength(2)
    for (const link of loginLinks) {
      expect(link).toHaveAttribute('href', '/auth/login?returnTo=%2Faccount')
    }
    expect(
      screen.getByRole('link', { name: 'Mot de passe oublié ?' }),
    ).toHaveAttribute(
      'href',
      '/auth/mot-de-passe-oublie?email=camille%40hotel-des-pins.fr',
    )
    expect(
      screen.getByRole('button', { name: 'Créer mon espace' }),
    ).toBeEnabled()
  })

  it('traduit un mot de passe refusé par le service', async () => {
    stubLocation()
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Password should be at least 8 characters.',
        code: 'weak_password',
      },
    })
    render(<Page />)

    fillForm()
    submit()

    expect(
      await screen.findByText(
        'Votre mot de passe doit contenir au moins 8 caractères.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Password should/)).toBeNull()
  })
})
