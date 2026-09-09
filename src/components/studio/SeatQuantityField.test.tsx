import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { confirmedOption, item, option, seat, stock } from '@/lib/studio/fixtures.test-helpers'
import type { FulfillmentContext } from '@/lib/studio/types'

import { SeatQuantityField } from './SeatQuantityField'

const product = seat('chair', { name: 'Chaise BASTILLE' })

function renderField(quantity: number, context: FulfillmentContext, onChange = vi.fn()) {
  render(<SeatQuantityField item={item('chair', quantity)} product={product} context={context} onChange={onChange} />)
  return onChange
}

describe('SeatQuantityField', () => {
  it('accepte 1 et affiche la règle de série à titre informatif', () => {
    renderField(1, { stock: [], options: [] })
    const input = screen.getByLabelText('Quantité souhaitée')
    expect(input).toHaveValue(1)
    expect(input).toHaveAttribute('min', '1')
    expect(screen.getByText(/Règle de série indicative : Min\. 50 puis \+10/)).toBeInTheDocument()
  })

  it("accepte 6 avec un MOQ de 50, n'arrondit jamais, n'empêche jamais de continuer", () => {
    const onChange = renderField(6, { stock: [], options: [option('chair', 'standard_production')] })
    const input = screen.getByLabelText('Quantité souhaitée')
    expect(input).toHaveValue(6)
    expect(input).not.toBeDisabled()
    expect(input).not.toHaveAttribute('aria-invalid')
    fireEvent.change(input, { target: { value: '7' } })
    expect(onChange).toHaveBeenLastCalledWith(7)
    fireEvent.change(input, { target: { value: '53' } })
    expect(onChange).toHaveBeenLastCalledWith(53)
    fireEvent.change(input, { target: { value: '0' } })
    expect(onChange).toHaveBeenLastCalledWith(1)
    expect(onChange).not.toHaveBeenCalledWith(50)
    expect(onChange).not.toHaveBeenCalledWith(60)
  })

  it('cas A — stock réel suffisant : « Disponible en stock »', () => {
    renderField(6, { stock: [stock('chair', 10)], options: [] })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('data-tone', 'confirmed')
    expect(status).toHaveAttribute('data-mode', 'stock')
    expect(screen.getByText('Disponible en stock')).toBeInTheDocument()
    expect(screen.getByText('10 unités disponibles pour ce design.')).toBeInTheDocument()
  })

  it('cas B — ni stock ni voie confirmée : « Quantité sous le minimum de série : nous étudions la faisabilité »', () => {
    renderField(6, { stock: [], options: [option('chair', 'standard_production')] })
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('data-tone', 'review')
    expect(status).toHaveAttribute('data-mode', 'manual_review')
    expect(screen.getByText('Quantité sous le minimum de série (50) : nous étudions la faisabilité')).toBeInTheDocument()
    expect(screen.queryByText(/manual_review|below_moq/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Disponible en stock/)).toBeNull()
  })

  it('ne prétend jamais que 6 sont disponibles avec 4 en stock', () => {
    renderField(6, { stock: [stock('chair', 4)], options: [] })
    expect(screen.queryByText('Disponible en stock')).toBeNull()
    expect(screen.getByText(/4 unités en stock, insuffisant pour 6/)).toBeInTheDocument()
  })

  it('production confirmée pour 50 : voie confirmée ; seed non confirmée : devis à confirmer', () => {
    const { unmount } = render(
      <SeatQuantityField item={item('chair', 50)} product={product} context={{ stock: [], options: [confirmedOption('chair', 'standard_production')] }} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'confirmed')
    expect(screen.getByText('Production standard confirmée')).toBeInTheDocument()
    unmount()
    render(
      <SeatQuantityField item={item('chair', 50)} product={product} context={{ stock: [], options: [option('chair', 'standard_production')] }} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'quote')
    expect(screen.getByText('Série standard connue, production à confirmer')).toBeInTheDocument()
  })

  it("l'état n'est pas exprimé par la couleur seule : icône + libellé + texte", () => {
    renderField(6, { stock: [], options: [] })
    const status = screen.getByRole('status')
    expect(status.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Étude de faisabilité')).toBeInTheDocument()
    expect(status).toHaveAttribute('aria-live', 'polite')
  })
})
