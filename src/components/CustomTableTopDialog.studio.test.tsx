import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { CustomTableTopDialog } from './CustomTableTopDialog'
it('callback Studio conserve le besoin sans appel contact ni identité', () => {
  const save = vi.fn(),
    close = vi.fn(),
    fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(
    <CustomTableTopDialog open onOpenChange={close} onSaveProject={save} />,
  )
  fireEvent.change(screen.getByLabelText('Longueur (cm)'), {
    target: { value: '95' },
  })
  fireEvent.change(screen.getByLabelText('Largeur (cm)'), {
    target: { value: '65' },
  })
  fireEvent.change(screen.getByLabelText('Matière / coloris souhaité'), {
    target: { value: 'Chêne' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Conserver dans mon projet' }),
  )
  expect(save).toHaveBeenCalledWith({
    shape: 'rectangular',
    length: 95,
    width: 65,
    finish: 'Chêne',
  })
  expect(fetch).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledWith(false)
  vi.unstubAllGlobals()
})
