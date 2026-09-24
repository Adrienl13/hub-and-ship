import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CustomerFileData,
  CustomerProfile,
} from '@/lib/admin/customer-file'

// Rendu de la fiche client 360 : en-tête, tuiles, chronologie et liens
// d'onglet. Le chargement (loadCustomerFile) et le client Supabase sont
// remplacés ; l'assemblage pur reste réel.

const loadCustomerFile = vi.fn()

vi.mock('@/lib/admin/customer-file', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/admin/customer-file')
  >('@/lib/admin/customer-file')
  return {
    ...actual,
    loadCustomerFile: (...args: unknown[]) => loadCustomerFile(...args),
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
  createSupabaseBrowserClient: () => ({ marker: 'browser-client' }),
}))

import { CustomerFile } from './CustomerFile'

const profile: CustomerProfile = {
  email: 'client@exemple.test',
  firstName: 'Camille',
  lastName: 'Test',
  phone: '06 12 34 56 78',
  createdAt: '2026-03-01T10:00:00.000Z',
  lastLoginAt: '2026-09-20T08:30:00.000Z',
  marketingConsent: true,
  marketingConsentAt: '2026-03-01T10:00:00.000Z',
  company: {
    legalName: 'SARL Terrasse Test',
    tradingName: 'Café Test',
    channel: 'revendeur',
  },
}

const data: CustomerFileData = {
  contactRequests: [
    {
      id: 'cr-1',
      status: 'new',
      topic: 'devis',
      created_at: '2026-09-22T09:00:00.000Z',
    },
    {
      id: 'cr-2',
      status: 'lost',
      topic: 'produit',
      created_at: '2026-04-02T09:00:00.000Z',
    },
  ],
  reservations: [
    {
      id: 'r-1',
      reference: 'RES-001',
      status: 'deposit_paid',
      total_ht: 12500,
      total_ttc: 15000,
      created_at: '2026-06-10T12:00:00.000Z',
      container_id: 'c-1',
    },
  ],
  stockRequests: [],
  partnerApplications: [],
  followUps: [
    {
      id: 'f-1',
      target_kind: 'reservation',
      target_id: 'r-1',
      subject: 'Votre acompte',
      template: 'paiement',
      sent_at: '2026-09-23T14:00:00.000Z',
    },
  ],
}

const empty: CustomerFileData = {
  contactRequests: [],
  reservations: [],
  stockRequests: [],
  partnerApplications: [],
  followUps: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  loadCustomerFile.mockResolvedValue(data)
})

describe('CustomerFile', () => {
  it('renders the contact header, the four tiles and the timeline with tab links', async () => {
    render(
      <CustomerFile userId="u-1" email={profile.email} profile={profile} />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement de la fiche…',
    )
    await screen.findByText('Votre acompte')

    expect(loadCustomerFile).toHaveBeenCalledWith(
      expect.objectContaining({ marker: 'browser-client' }),
      { userId: 'u-1', email: 'client@exemple.test' },
    )

    // En-tête : nom, établissement + canal, liens mailto / tel, consentement,
    // inscription, dernière connexion (heure de Paris).
    expect(screen.getByText('Camille Test')).toBeInTheDocument()
    expect(
      screen.getByText(/Café Test \(SARL Terrasse Test\)/),
    ).toBeInTheDocument()
    expect(screen.getByText('Revendeur')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'client@exemple.test' }),
    ).toHaveAttribute('href', 'mailto:client@exemple.test')
    expect(
      screen.getByRole('link', { name: '06 12 34 56 78' }),
    ).toHaveAttribute('href', 'tel:0612345678')
    expect(screen.getByText('Consentement le 01/03/2026')).toBeInTheDocument()
    expect(screen.getByText('01/03/2026')).toBeInTheDocument()
    // Dans l'en-tête et sur l'événement « Dernière connexion ».
    expect(screen.getAllByText('20/09/2026 10:30')).toHaveLength(2)

    // Tuiles : 1 demande ouverte sur 2, 1 réservation, CA HT encaissé,
    // dernière interaction = la relance du 23/09.
    expect(screen.getByText('Demandes ouvertes')).toBeInTheDocument()
    expect(screen.getByText('2 demandes au total')).toBeInTheDocument()
    expect(screen.getByText('CA HT encaissé')).toBeInTheDocument()
    expect(screen.getByText(/^12\s500\s€ HT$/)).toBeInTheDocument()
    expect(screen.getByText('23/09/2026')).toBeInTheDocument()

    // Chronologie : la relance en tête, puis la demande, la connexion, la
    // réservation, l'autre demande et l'inscription.
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(6)
    expect(items[0]).toHaveTextContent('Relance')
    expect(items[0]).toHaveTextContent('Votre acompte')
    expect(items[0]).toHaveTextContent('Modèle paiement · sur réservation')
    expect(items[1]).toHaveTextContent('Demande de devis')
    expect(items[2]).toHaveTextContent('Dernière connexion')
    expect(items[3]).toHaveTextContent('Réservation RES-001')
    expect(items[5]).toHaveTextContent('Compte créé')

    expect(
      screen.getAllByRole('link', { name: /Voir dans Réservations/ }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('link', { name: /Voir dans Demandes/ })[0],
    ).toHaveAttribute('href', '/admin?tab=demandes')
  })

  it('shows the empty state when the contact left nothing yet', async () => {
    loadCustomerFile.mockResolvedValue(empty)
    render(
      <CustomerFile
        userId="u-2"
        email="neuf@exemple.test"
        profile={{
          ...profile,
          firstName: null,
          lastName: null,
          phone: null,
          company: null,
          marketingConsent: false,
          lastLoginAt: null,
        }}
      />,
    )

    await screen.findByText('Aucune interaction pour le moment')
    expect(screen.getByText('Nom non renseigné')).toBeInTheDocument()
    expect(screen.getByText('Aucun établissement rattaché')).toBeInTheDocument()
    expect(screen.getByText('Téléphone non renseigné')).toBeInTheDocument()
    expect(screen.getByText('Sans consentement')).toBeInTheDocument()
    expect(screen.getByText('Jamais connecté')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    // Le résumé reste affiché, à zéro.
    expect(screen.getByText('0 demande au total')).toBeInTheDocument()
  })

  it('explains a loading error and retries on demand', async () => {
    loadCustomerFile.mockRejectedValueOnce(new Error('Relances : RLS'))
    render(
      <CustomerFile userId="u-1" email={profile.email} profile={profile} />,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Impossible de charger la fiche client : Relances : RLS',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await screen.findByText('Votre acompte')
    expect(loadCustomerFile).toHaveBeenCalledTimes(2)
  })
})
