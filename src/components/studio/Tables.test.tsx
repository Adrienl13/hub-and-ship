import { fireEvent, render, screen, within } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { top, base, data } from '@/lib/studio/table.test-helpers'
import { item, seat } from '@/lib/studio/fixtures.test-helpers'
import type { TableConfiguration } from '@/lib/studio/table-project'
import { TabletopPicker } from './TabletopPicker'
import { BasePicker } from './BasePicker'
import { TableQuantityField } from './TableQuantityField'
import { ProjectSummary, projectOverview } from './ProjectSummary'
import { ProjectBottomBar } from './ProjectBottomBar'
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode
    to: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
const config: TableConfiguration = {
  id: 'table',
  top: { productId: top.id, variantId: top.variants[0]!.id },
  base: { productId: base.id, variantId: base.variants[0]!.id },
  quantity: 30,
  quantityEdited: false,
  custom: null,
  verificationRequested: false,
  baseInvalidated: false,
}
it('forme puis dimension expose toutes les variantes pertinentes', () => {
  const select = vi.fn()
  render(
    <TabletopPicker
      products={[
        {
          ...top,
          variants: [
            ...top.variants,
            { ...top.variants[0]!, id: 'other', name: 'Autre finition' },
          ],
        },
      ]}
      selection={null}
      onSelect={select}
      onCustom={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /carré/ }))
  fireEvent.click(screen.getByRole('button', { name: '70 × 70 cm' }))
  fireEvent.click(screen.getByRole('button', { name: /Autre finition/ }))
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ id: top.id }),
    'other',
  )
  expect(screen.getByRole('button', { name: '70 × 70 cm' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
it('aucune compatibilité incertaine selectable', () => {
  render(
    <BasePicker
      top={top}
      products={[base, { ...base, id: 'unknown', name: 'Inconnu' }]}
      data={data}
      selected={null}
      onSelect={vi.fn()}
      onVerify={vi.fn()}
      requested={false}
    />,
  )
  expect(
    screen.getByRole('button', { name: new RegExp(base.name) }),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: /Inconnu/ })).toBeNull()
})
it('sans allowed conserve un chemin de vérification', () => {
  const verify = vi.fn()
  render(
    <BasePicker
      top={top}
      products={[base]}
      data={{ ...data, rules: [] }}
      selected={null}
      onSelect={vi.fn()}
      onVerify={verify}
      requested={false}
    />,
  )
  expect(
    screen.getByText(
      'Aucun piètement compatible vérifié pour cette configuration.',
    ),
  ).toBeVisible()
  fireEvent.click(
    screen.getByRole('button', { name: 'Demander une vérification' }),
  )
  expect(verify).toHaveBeenCalledOnce()
})
it('plateau incomplet ne devient pas une option inventée', () => {
  render(
    <TabletopPicker
      products={[{ ...top, variants: [] }]}
      selection={null}
      onSelect={vi.fn()}
      onCustom={vi.fn()}
    />,
  )
  expect(screen.getByText(/Aucun plateau Studio prêt/)).toBeVisible()
  expect(screen.getByRole('button', { name: /Autre dimension/ })).toBeVisible()
})
it('quantité 17 reste libre sous MOQ', () => {
  const change = vi.fn()
  render(
    <TableQuantityField
      config={config}
      top={top}
      base={base}
      suggestion={30}
      onChange={change}
    />,
  )
  fireEvent.change(screen.getByLabelText('Quantité de tables'), {
    target: { value: '17' },
  })
  expect(change).toHaveBeenCalledWith(17)
})
it('rail et mobile partagent 60 assises + 30 tables = 90 et état conservateur', () => {
  const props = {
    entry: 'full_project' as const,
    items: [item('s', 60)],
    tables: [config],
    productsById: new Map([seat('s'), top, base].map((p) => [p.id, p])),
    compatibility: { ...data, rules: [] },
    context: { stock: [], options: [] },
    onQuantityChange: vi.fn(),
    onRemove: vi.fn(),
  }
  expect(projectOverview(props)).toMatchObject({
    totalUnits: 90,
    unresolved: true,
    state: 'manual_quote_required',
  })
  const rendered = render(<ProjectSummary {...props} />)
  expect(screen.getByTestId('project-table')).toHaveTextContent('Tables × 30')
  expect(screen.getByTestId('project-table')).not.toHaveTextContent(
    'Configuration compatible',
  )
  rendered.unmount()
  render(<ProjectBottomBar {...props} />)
  expect(screen.getByTestId('project-bottom-bar')).toHaveTextContent(
    'Votre projet · 90 éléments',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir mon projet' }))
  expect(
    within(screen.getByRole('dialog')).getByTestId('project-table'),
  ).toHaveTextContent('Tables × 30')
})

it('une référence sur demande reste accessible sans prix simulé', () => {
  const select = vi.fn()
  render(
    <TabletopPicker
      products={[{ ...top, visibility: 'on_request' }]}
      selection={null}
      onSelect={select}
      onCustom={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Rectangulaire / carré' }))
  fireEvent.click(screen.getByRole('button', { name: '70 × 70 cm' }))
  const choice = screen.getByRole('button', { name: new RegExp(top.name) })
  expect(choice).toHaveTextContent('Prix à confirmer')
  expect(choice).not.toHaveTextContent('€')
  fireEvent.click(choice)
  expect(select).toHaveBeenCalledOnce()
})
