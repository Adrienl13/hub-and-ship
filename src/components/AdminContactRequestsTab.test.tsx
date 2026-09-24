import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminContactRequestRow } from '@/lib/contact-requests/admin-repository'

// Rendu léger de l'onglet « Demandes » : compteurs, filtres, transition de
// statut auditée. Le dépôt et le client Supabase sont remplacés ; les helpers
// purs (libellés, transitions, recherche) restent réels.

const adminListContactRequests = vi.fn()
const adminUpdateContactRequestStatus = vi.fn()
const adminUpdateContactRequestNote = vi.fn()
const logAdminAction = vi.fn()
const listFollowUpsForTargets = vi.fn()
const sendAdminFollowUp = vi.fn()

vi.mock('@/lib/admin/follow-ups.repository', () => ({
  listFollowUpsForTargets: (...args: unknown[]) =>
    listFollowUpsForTargets(...args),
}))

vi.mock('@/lib/admin/follow-ups.send', () => ({
  sendAdminFollowUp: (...args: unknown[]) => sendAdminFollowUp(...args),
}))

vi.mock('@/lib/contact-requests/admin-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/contact-requests/admin-repository')
  >('@/lib/contact-requests/admin-repository')
  return {
    ...actual,
    adminListContactRequests: (...args: unknown[]) =>
      adminListContactRequests(...args),
    adminUpdateContactRequestStatus: (...args: unknown[]) =>
      adminUpdateContactRequestStatus(...args),
    adminUpdateContactRequestNote: (...args: unknown[]) =>
      adminUpdateContactRequestNote(...args),
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

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, status: 'authenticated' }),
}))

vi.mock('@/lib/admin/audit-log', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

import { toast } from 'sonner'

import { AdminContactRequestsTab } from './AdminContactRequestsTab'

function makeRow(
  overrides: Partial<AdminContactRequestRow> = {},
): AdminContactRequestRow {
  return {
    id: 'cr-1',
    status: 'new',
    topic: 'devis',
    topicLabel: 'Demande de devis',
    source: 'catalogue_quick_quote',
    sourceLabel: 'Devis rapide catalogue',
    name: 'Contact Un',
    email: 'un@exemple.test',
    company: 'Brasserie Test',
    phone: '06 00 00 00 00',
    message: 'Bonjour, je souhaite un devis pour quarante chaises.',
    productSku: 'CHA-CAN-001',
    productName: 'Chaise CANNES',
    productDesign: 'Sable',
    quantity: 40,
    priceLabel: '60 € HT',
    studioBrief: null,
    utmSource: 'linkedin',
    utmMedium: null,
    utmCampaign: null,
    partnerRef: null,
    internalNote: null,
    createdAt: '2026-09-24T09:00:00.000Z',
    updatedAt: '2026-09-24T09:00:00.000Z',
    ...overrides,
  }
}

const rows: ReadonlyArray<AdminContactRequestRow> = [
  makeRow(),
  makeRow({
    id: 'cr-2',
    status: 'quoted',
    topic: 'produit',
    topicLabel: 'Produit / catalogue',
    source: 'contact_page',
    sourceLabel: 'Page contact',
    name: 'Contact Deux',
    email: 'deux@exemple.test',
    company: 'Hôtel Test',
    phone: null,
    productSku: null,
    productName: null,
    productDesign: null,
    quantity: null,
    priceLabel: null,
    utmSource: null,
    internalNote: 'Rappeler jeudi',
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  adminListContactRequests.mockResolvedValue(rows)
  adminUpdateContactRequestStatus.mockResolvedValue(undefined)
  adminUpdateContactRequestNote.mockResolvedValue(undefined)
  logAdminAction.mockResolvedValue(undefined)
  listFollowUpsForTargets.mockResolvedValue(
    new Map([
      [
        'cr-2',
        [
          { id: 'fu-1', targetId: 'cr-2', sentAt: '2026-09-20T08:00:00.000Z' },
          { id: 'fu-2', targetId: 'cr-2', sentAt: '2026-09-22T08:00:00.000Z' },
        ],
      ],
    ]),
  )
  sendAdminFollowUp.mockResolvedValue({
    ok: true,
    traced: true,
    followUpId: 'fu-3',
    deliveryId: 'brevo-3',
  })
})

describe('AdminContactRequestsTab', () => {
  it('lists the requests with status counters, labels and contact links', async () => {
    render(<AdminContactRequestsTab authStatus="authenticated" />)

    await screen.findByText('Contact Un')
    expect(screen.getByText('Contact Deux')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    // Compteurs par statut : 1 nouvelle, 1 devis envoyé, 0 ailleurs.
    const newCounter = screen.getByRole('button', { name: /1\s*Nouvelle/ })
    expect(newCounter).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('button', { name: /1\s*Devis envoyé/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /0\s*Gagnée/ }),
    ).toBeInTheDocument()

    // La source apparaît sur la carte et dans le filtre « source ».
    expect(screen.getAllByText('Devis rapide catalogue')).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: /un@exemple.test/ }),
    ).toHaveAttribute('href', 'mailto:un@exemple.test')
    expect(
      screen.getByRole('link', { name: /06 00 00 00 00/ }),
    ).toHaveAttribute('href', 'tel:0600000000')
    expect(
      screen.getByText(/Chaise CANNES · CHA-CAN-001 · Sable · 40 u/),
    ).toBeInTheDocument()
    expect(screen.getByText('Origine : linkedin')).toBeInTheDocument()
    // Sans UTM ni partenaire, l'origine retombe sur le point de capture.
    expect(screen.getByText('Origine : Page contact')).toBeInTheDocument()
    // Date-heure au format admin (heure de Paris).
    expect(screen.getAllByText('24/09/2026 11:00')).toHaveLength(2)
    expect(screen.getByText(/Rappeler jeudi/)).toBeInTheDocument()
  })

  it('filters by status counter and by text search', async () => {
    render(<AdminContactRequestsTab authStatus="authenticated" />)
    await screen.findByText('Contact Un')

    fireEvent.click(screen.getByRole('button', { name: /1\s*Devis envoyé/ }))
    expect(screen.queryByText('Contact Un')).not.toBeInTheDocument()
    expect(screen.getByText('Contact Deux')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))
    fireEvent.change(screen.getByLabelText('Rechercher une demande'), {
      target: { value: 'brasserie' },
    })
    expect(screen.getByText('Contact Un')).toBeInTheDocument()
    expect(screen.queryByText('Contact Deux')).not.toBeInTheDocument()
  })

  it('moves a new request to contacted and audits the transition', async () => {
    render(<AdminContactRequestsTab authStatus="authenticated" />)
    await screen.findByText('Contact Un')

    fireEvent.click(screen.getByRole('button', { name: 'Contactée' }))

    await waitFor(() =>
      expect(adminUpdateContactRequestStatus).toHaveBeenCalledWith(
        expect.objectContaining({ marker: 'browser-client' }),
        'cr-1',
        'contacted',
      ),
    )
    await waitFor(() =>
      expect(logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ marker: 'browser-client' }),
        'admin-1',
        expect.objectContaining({
          action: 'contact_request.status_change',
          target: 'cr-1',
          previousValue: 'new',
          nextValue: 'contacted',
        }),
      ),
    )
    // La liste est relue après la mutation.
    expect(adminListContactRequests).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Demande contactée')
  })

  it('announces a reopened request instead of a "new" one', async () => {
    adminListContactRequests.mockResolvedValue([
      makeRow({ id: 'cr-3', status: 'lost', name: 'Contact Trois' }),
    ])
    render(<AdminContactRequestsTab authStatus="authenticated" />)
    await screen.findByText('Contact Trois')

    fireEvent.click(screen.getByRole('button', { name: 'Rouvrir' }))

    await waitFor(() =>
      expect(adminUpdateContactRequestStatus).toHaveBeenCalledWith(
        expect.objectContaining({ marker: 'browser-client' }),
        'cr-3',
        'new',
      ),
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Demande rouverte'),
    )
  })

  it('shows the follow-up badge and loads follow-ups for the listed requests', async () => {
    render(<AdminContactRequestsTab authStatus="authenticated" />)
    await screen.findByText('Contact Un')

    await waitFor(() =>
      expect(listFollowUpsForTargets).toHaveBeenCalledWith(
        expect.objectContaining({ marker: 'browser-client' }),
        'contact_request',
        ['cr-1', 'cr-2'],
      ),
    )
    expect(
      await screen.findByText('Relancé le 22/09/2026 (2)'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Relancé le 20\/09/)).not.toBeInTheDocument()
  })

  it('still lists requests when follow-ups cannot be read', async () => {
    listFollowUpsForTargets.mockRejectedValue(new Error('RLS denied'))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<AdminContactRequestsTab authStatus="authenticated" />)

    await screen.findByText('Contact Un')
    expect(screen.queryByText('RLS denied')).not.toBeInTheDocument()
    expect(screen.queryByText(/Relancé le/)).not.toBeInTheDocument()
  })

  it('sends a follow-up from the dialog, moves the new request to contacted and audits it', async () => {
    render(<AdminContactRequestsTab authStatus="authenticated" />)
    await screen.findByText('Contact Un')

    fireEvent.click(screen.getByRole('button', { name: 'Relancer Contact Un' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Contact Un <un@exemple.test>')
    // Sujet « devis » → modèle devis présélectionné, prérempli avec le produit.
    expect(screen.getByRole('button', { name: 'Devis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      (screen.getByLabelText('Message') as HTMLTextAreaElement).value,
    ).toContain('Chaise CANNES (40 unités) pour Brasserie Test')

    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    await waitFor(() =>
      expect(sendAdminFollowUp).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetKind: 'contact_request',
          targetId: 'cr-1',
          recipientEmail: 'un@exemple.test',
          recipientName: 'Contact Un',
          template: 'devis',
          subject: 'Votre devis Terrassea',
        }),
      }),
    )
    await waitFor(() =>
      expect(adminUpdateContactRequestStatus).toHaveBeenCalledWith(
        expect.objectContaining({ marker: 'browser-client' }),
        'cr-1',
        'contacted',
      ),
    )
    await waitFor(() =>
      expect(logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ marker: 'browser-client' }),
        'admin-1',
        expect.objectContaining({
          action: 'contact_request.follow_up',
          target: 'cr-1',
          previousValue: 'new',
          nextValue: 'contacted',
          extra: { template: 'devis', traced: true },
        }),
      ),
    )
    // Liste et relances relues après l'envoi ; le dialogue est fermé.
    await waitFor(() =>
      expect(adminListContactRequests).toHaveBeenCalledTimes(2),
    )
    expect(listFollowUpsForTargets).toHaveBeenCalledTimes(2)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(toast.success).toHaveBeenCalledWith(
      'Relance envoyée',
      expect.anything(),
    )
  })

  it('does not change the status of an already-followed request', async () => {
    render(<AdminContactRequestsTab authStatus="authenticated" />)
    await screen.findByText('Contact Deux')

    fireEvent.click(
      screen.getByRole('button', { name: 'Relancer Contact Deux' }),
    )
    await screen.findByRole('dialog')
    // Sujet « produit » → modèle informations.
    expect(
      screen.getByRole('button', { name: 'Informations' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    await waitFor(() =>
      expect(logAdminAction).toHaveBeenCalledWith(
        expect.anything(),
        'admin-1',
        expect.objectContaining({
          action: 'contact_request.follow_up',
          target: 'cr-2',
        }),
      ),
    )
    expect(adminUpdateContactRequestStatus).not.toHaveBeenCalled()
    const metadata = logAdminAction.mock.calls[0]![2] as Record<string, unknown>
    expect(metadata.previousValue).toBeUndefined()
  })

  it('shows the database error instead of an empty list', async () => {
    adminListContactRequests.mockRejectedValueOnce(new Error('RLS denied'))
    render(<AdminContactRequestsTab authStatus="anonymous" />)
    await screen.findByText('RLS denied')
    expect(
      screen.getByText(/pas connecté en tant qu.admin/),
    ).toBeInTheDocument()
    expect(adminUpdateContactRequestNote).not.toHaveBeenCalled()
  })
})
