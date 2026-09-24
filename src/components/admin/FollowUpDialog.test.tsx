import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FollowUpTarget } from './FollowUpDialog'

// Rendu du dialogue « Relancer » : préremplissage selon le modèle, édition,
// validation, appel de la fonction serveur, toasts et callback onSent. La
// fonction serveur est remplacée ; les helpers purs restent réels.

const sendAdminFollowUp = vi.fn()

vi.mock('@/lib/admin/follow-ups.send', () => ({
  sendAdminFollowUp: (...args: unknown[]) => sendAdminFollowUp(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

import { toast } from 'sonner'

import { FollowUpDialog } from './FollowUpDialog'

const TARGET: FollowUpTarget = {
  kind: 'contact_request',
  id: '3f6a4d2e-8f1b-4c8e-9a1d-2b7c6e5f4a3b',
  recipientName: 'Camille Test',
  recipientEmail: 'camille@exemple.test',
  context: {
    name: 'Camille Test',
    company: 'Brasserie Test',
    productName: 'Chaise CANNES',
    quantity: 40,
    priceLabel: '60 € HT',
  },
  defaultTemplate: 'devis',
}

beforeEach(() => {
  vi.clearAllMocks()
  sendAdminFollowUp.mockResolvedValue({
    ok: true,
    traced: true,
    followUpId: 'fu-1',
    deliveryId: 'brevo-1',
  })
})

function subjectInput(): HTMLInputElement {
  return screen.getByLabelText('Sujet') as HTMLInputElement
}

function bodyInput(): HTMLTextAreaElement {
  return screen.getByLabelText('Message') as HTMLTextAreaElement
}

describe('FollowUpDialog', () => {
  it('renders nothing without a target', () => {
    render(<FollowUpDialog target={null} onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('prefills subject and body from the default template and shows the recipient', () => {
    render(<FollowUpDialog target={TARGET} onClose={() => undefined} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('follow-up-recipient')).toHaveTextContent(
      'Camille Test <camille@exemple.test>',
    )
    expect(
      screen.getByTestId('follow-up-recipient').parentElement,
    ).toHaveTextContent('· Brasserie Test')
    expect(screen.getByRole('button', { name: 'Devis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(subjectInput().value).toBe('Votre devis Terrassea')
    expect(bodyInput().value).toContain(
      'demande de devis pour Chaise CANNES (40 unités) pour Brasserie Test.',
    )
  })

  it('switching the template replaces subject and body', () => {
    render(<FollowUpDialog target={TARGET} onClose={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Paiement' }))
    expect(subjectInput().value).toBe(
      'Votre réservation Terrassea : règlement en attente',
    )
    expect(bodyInput().value).toContain('frais de réservation')

    fireEvent.click(screen.getByRole('button', { name: 'Message libre' }))
    expect(subjectInput().value).toBe('Un message de Terrassea')
    expect(bodyInput().value).toBe('')
  })

  it('blocks a too-short message before calling the server', async () => {
    render(<FollowUpDialog target={TARGET} onClose={() => undefined} />)

    fireEvent.change(bodyInput(), { target: { value: 'Trop court.' } })
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    expect(
      await screen.findByText(/au moins 20 caractères/),
    ).toBeInTheDocument()
    expect(sendAdminFollowUp).not.toHaveBeenCalled()
  })

  it('sends the edited follow-up, toasts, notifies the parent and closes', async () => {
    const onClose = vi.fn()
    const onSent = vi.fn()
    render(
      <FollowUpDialog
        target={{ ...TARGET, ctaUrl: '/catalogue', ctaLabel: 'Voir' }}
        onClose={onClose}
        onSent={onSent}
      />,
    )

    fireEvent.change(subjectInput(), {
      target: { value: '  Votre devis, suite  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    await waitFor(() => expect(sendAdminFollowUp).toHaveBeenCalledTimes(1))
    expect(sendAdminFollowUp).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetKind: 'contact_request',
        targetId: TARGET.id,
        recipientEmail: 'camille@exemple.test',
        recipientName: 'Camille Test',
        subject: 'Votre devis, suite',
        template: 'devis',
        ctaUrl: '/catalogue',
        ctaLabel: 'Voir',
      }),
    })
    const payload = sendAdminFollowUp.mock.calls[0]![0] as {
      data: { body: string; reference?: string }
    }
    expect(payload.data.body).toContain('Chaise CANNES')
    // Pas de référence dans le contexte : la clé n'est pas envoyée.
    expect(payload.data.reference).toBeUndefined()

    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
    expect(onSent).toHaveBeenCalledWith(
      expect.objectContaining({ id: TARGET.id }),
      { template: 'devis', subject: 'Votre devis, suite', traced: true },
    )
    expect(onClose).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith(
      'Relance envoyée',
      expect.objectContaining({ description: 'À camille@exemple.test' }),
    )
  })

  it('warns when the email left but the trace failed', async () => {
    sendAdminFollowUp.mockResolvedValue({
      ok: true,
      traced: false,
      deliveryId: 'brevo-1',
    })
    const onSent = vi.fn()
    render(
      <FollowUpDialog
        target={TARGET}
        onClose={() => undefined}
        onSent={onSent}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
    expect(onSent.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ traced: false }),
    )
    expect(toast.warning).toHaveBeenCalledWith(
      'Relance envoyée mais non tracée',
      expect.anything(),
    )
  })

  it('keeps the dialog open and explains a refused send', async () => {
    sendAdminFollowUp.mockResolvedValue({ ok: false, reason: 'forbidden' })
    const onClose = vi.fn()
    const onSent = vi.fn()
    render(<FollowUpDialog target={TARGET} onClose={onClose} onSent={onSent} />)

    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Relance non envoyée',
        expect.objectContaining({
          description: expect.stringContaining('Session admin requise'),
        }),
      ),
    )
    expect(onSent).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Le bouton redevient actif pour réessayer.
    expect(
      screen.getByRole('button', { name: /Envoyer la relance/ }),
    ).toBeEnabled()
  })

  it('reports a transport error without closing', async () => {
    sendAdminFollowUp.mockRejectedValue(new Error('Network down'))
    render(<FollowUpDialog target={TARGET} onClose={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: /Envoyer la relance/ }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Relance non envoyée', {
        description: 'Network down',
      }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose from the cancel button', () => {
    const onClose = vi.fn()
    render(<FollowUpDialog target={TARGET} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(sendAdminFollowUp).not.toHaveBeenCalled()
  })
})
