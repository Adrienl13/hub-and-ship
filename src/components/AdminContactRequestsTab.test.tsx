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
  toast: { success: vi.fn(), error: vi.fn() },
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
