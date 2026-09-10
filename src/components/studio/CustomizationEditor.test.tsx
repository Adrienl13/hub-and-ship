import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { CustomizationEditor } from './CustomizationEditor'
import { CustomizationSummary } from './CustomizationSummary'
import {
  evaluateCustomization,
  type CustomizationCapability,
} from '@/lib/studio/customization'
const target = {
  key: 'seat',
  scope: 'seat' as const,
  productId: 'p',
  quantity: 60,
}
const cap: CustomizationCapability = {
  id: 'c',
  scope: 'seat',
  product_id: 'p',
  kind: 'structure_color',
  status: 'verified',
  values: ['Bleu'],
  allows_free_text: false,
  requires_review: false,
  min_quantity: null,
  max_quantity: null,
}
it('option unavailable non sélectionnable, unknown explicitement non confirmé', () => {
  render(
    <CustomizationEditor
      title="Apparence"
      target={target}
      selections={[]}
      data={{
        available: true,
        capabilities: [{ ...cap, status: 'unavailable' }],
      }}
      onChange={vi.fn()}
    />,
  )
  expect(
    screen.getByLabelText('Apparence — Couleur de structure'),
  ).toBeDisabled()
  expect(screen.getAllByText('À confirmer').length).toBeGreaterThan(0)
  expect(
    screen.getByLabelText('Apparence — Précisions Couleur de corde'),
  ).toBeEnabled()
})
it('option verified sélectionnée explicitement et résumé reflète le statut', () => {
  const change = vi.fn()
  const data = { available: true, capabilities: [cap] }
  render(
    <CustomizationEditor
      title="Apparence"
      target={target}
      selections={[]}
      data={data}
      onChange={change}
    />,
  )
  fireEvent.change(screen.getByLabelText('Apparence — Couleur de structure'), {
    target: { value: 'Bleu' },
  })
  const rows = change.mock.calls[0]![0]
  render(
    <CustomizationSummary
      rows={evaluateCustomization([target], { seat: rows }, data).selections}
    />,
  )
  expect(screen.getByLabelText('Personnalisation demandée')).toHaveTextContent(
    'Bleu — Validé',
  )
})
