import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EmailDomainWarning } from './EmailDomainWarning'
import { SiretInput, type SiretInputState } from './SiretInput'
import { SiretVerificationDisplay } from './SiretVerificationDisplay'
import { ValidatedInput } from './ValidatedInput'

describe('security form components', () => {
  it('renders accessible validation state for a generic input', () => {
    render(
      <ValidatedInput
        id="company"
        label="Société"
        value=""
        onValueChange={() => undefined}
        error="Societe requise"
      />,
    )

    const input = screen.getByLabelText('Société')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Societe requise')).toBeInTheDocument()
  })

  it('shows and accepts a personal email warning', async () => {
    const onAccept = vi.fn()
    const onEdit = vi.fn()
    const user = userEvent.setup()

    render(
      <EmailDomainWarning
        email="buyer@gmail.com"
        accepted={false}
        onAccept={onAccept}
        onEdit={onEdit}
      />,
    )

    expect(screen.getByText('Adresse personnelle détectée')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Je comprends, continuer' }),
    )

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('renders nothing for professional email domains', () => {
    const { container } = render(
      <EmailDomainWarning
        email="buyer@hotel-pro.fr"
        accepted={false}
        onAccept={() => undefined}
        onEdit={() => undefined}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('validates SIRET format and emits the cleaned value', async () => {
    const onValueChange = vi.fn()
    const onStateChange = vi.fn()
    const onVerified = vi.fn()
    const user = userEvent.setup()

    render(
      <SiretInput
        value="552 081 317 01750"
        state={{ status: 'idle' }}
        onValueChange={onValueChange}
        onStateChange={onStateChange}
        onVerified={onVerified}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vérifier mon SIRET' }))

    expect(onValueChange).toHaveBeenCalledWith('55208131701750')
    expect(onStateChange).toHaveBeenCalledWith({
      status: 'verified',
      siret: '55208131701750',
    })
    expect(onVerified).toHaveBeenCalledWith('55208131701750')
  })

  it('reports invalid SIRET checks', async () => {
    const onStateChange = vi.fn()
    const user = userEvent.setup()

    render(
      <SiretInput
        value="123"
        state={{ status: 'idle' }}
        onValueChange={() => undefined}
        onStateChange={onStateChange}
        onVerified={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vérifier mon SIRET' }))

    expect(onStateChange).toHaveBeenCalledWith({
      status: 'invalid',
      reason: 'Le SIRET doit contenir exactement 14 chiffres',
    })
  })

  it('displays every SIRET verification outcome tone', () => {
    const cases: ReadonlyArray<{
      state: SiretInputState
      title: string
    }> = [
      {
        state: { status: 'verified', siret: '55208131701750' },
        title: 'Format SIRET vérifié',
      },
      {
        state: {
          status: 'verification_unavailable',
          reason: 'Service indisponible',
        },
        title: 'Vérification temporairement indisponible',
      },
      {
        state: { status: 'duplicate', reason: 'Compte existant' },
        title: 'Compte existant détecté',
      },
      {
        state: { status: 'inactive', reason: 'Etablissement ferme' },
        title: 'Établissement fermé',
      },
    ]

    for (const { state, title } of cases) {
      const { unmount } = render(<SiretVerificationDisplay state={state} />)
      expect(screen.getByText(title)).toBeInTheDocument()
      unmount()
    }
  })
})
