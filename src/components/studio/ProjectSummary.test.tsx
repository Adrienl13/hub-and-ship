import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { item, seat, stock } from '@/lib/studio/fixtures.test-helpers'
import { useStudioStore } from '@/stores/studio.store'
import { lineTargets, seatKey } from '@/lib/studio/customization'
import {
  ProjectSummary,
  projectStateFor,
  projectOverview,
} from './ProjectSummary'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

it('conserve deux lignes dont une disparue, sans faux montant ni état prêt, suppression possible', () => {
  useStudioStore.getState().resetSession()
  const present = item('present', 6)
  const missing = item('missing', 4)
  useStudioStore.getState().upsertItem(present)
  useStudioStore.getState().upsertItem(missing)
  const productsById = new Map([['present', seat('present')]])
  const context = { stock: [stock('present', 10)], options: [] }
  expect(projectStateFor([present], productsById, context)).toBe(
    'reservation_ready',
  )
  expect(projectStateFor([present, missing], productsById, context)).toBe(
    'manual_quote_required',
  )
  function Project() {
    const items = useStudioStore((state) => state.project.items)
    return (
      <ProjectSummary
        entry="seats"
        items={items}
        productsById={productsById}
        context={context}
        onQuantityChange={vi.fn()}
        onRemove={(line) =>
          useStudioStore.getState().removeItem(line.productId, line.variantId)
        }
      />
    )
  }
  render(<Project />)
  const lines = screen.getByRole('list', { name: 'Lignes du projet' })
  expect(within(lines).getAllByRole('listitem')).toHaveLength(2)
  const missingLine = screen.getByText('Référence à vérifier').closest('li')!
  expect(missingLine).toHaveTextContent(
    'Cette référence n’est pas disponible'.replace('’', "'"),
  )
  expect(missingLine).not.toHaveTextContent('€')
  expect(missingLine).not.toHaveTextContent('stock')
  expect(screen.getByText('Montant à vérifier')).toBeVisible()
  fireEvent.click(within(missingLine).getByRole('button', { name: /Retirer/ }))
  expect(within(lines).getAllByRole('listitem')).toHaveLength(1)
  expect(useStudioStore.getState().project.items).toEqual([present])
})

it('un design disparu ou toutes les références absentes reste conservateur', () => {
  const products = new Map([['p', seat('p')]])
  expect(
    projectStateFor([item('p', 1, { variantId: 'missing' })], products, {
      stock: [],
      options: [],
    }),
  ).toBe('manual_quote_required')
  expect(
    projectStateFor([item('missing', 1)], products, { stock: [], options: [] }),
  ).toBe('manual_quote_required')
  expect(projectStateFor([], products, { stock: [], options: [] })).toBeNull()
})

it('une personnalisation inconnue déclasse un projet et laisse le lien de transmission actif', () => {
  const present = item('present', 6),
    target = lineTargets(seatKey(present), 6, { seat: 'present' })[1]!
  const props = {
    entry: 'seats' as const,
    items: [present],
    productsById: new Map([['present', seat('present')]]),
    context: { stock: [stock('present', 10)], options: [] },
    onQuantityChange: vi.fn(),
    onRemove: vi.fn(),
    customization: {
      [target.key]: [
        {
          kind: 'rope_color' as const,
          value: '',
          note: 'À étudier',
          requested: false,
        },
      ],
    },
  }
  expect(projectOverview(props).state).toBe('feasibility_review')
  render(<ProjectSummary {...props} />)
  expect(screen.getByLabelText('Personnalisation demandée')).toHaveTextContent(
    'À confirmer',
  )
  expect(
    screen.getByRole('link', { name: 'Personnaliser et envoyer le projet' }),
  ).toHaveAttribute('href', '/studio/personnalisation')
})
