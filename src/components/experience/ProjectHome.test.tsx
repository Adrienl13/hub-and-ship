import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProjectHome } from './ProjectHome'
const flag = vi.hoisted(() => ({ enabled: true }))
vi.mock('@/lib/studio/flags', () => ({ isStudioEnabled: () => flag.enabled }))
beforeEach(() => {
  flag.enabled = true
})
it('le projet est le point d’entrée, avec accès explicite au Studio et au catalogue', () => {
  render(<ProjectHome />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Votre lieu a',
  )
  expect(
    screen.getByRole('link', { name: 'Créer mon projet dans le Studio' }),
  ).toHaveAttribute('href', '/studio')
  expect(
    screen.getByRole('link', { name: 'Explorer le mobilier' }),
  ).toHaveAttribute('href', '/catalogue')
})
it('le flag OFF garde le Studio fermé et propose une prise de contact', () => {
  flag.enabled = false
  render(<ProjectHome />)
  expect(
    screen
      .queryAllByRole('link')
      .some((a) => a.getAttribute('href') === '/studio'),
  ).toBe(false)
  expect(
    screen.getByRole('link', { name: 'Construire mon projet' }),
  ).toHaveAttribute('href', '/contact')
})
it('changer une inspiration ne recolore jamais la photographie catalogue', () => {
  render(<ProjectHome />)
  const photo = screen.getByAltText(
    'Assise bistro, photographie catalogue originale',
  )
  const src = photo.getAttribute('src')
  fireEvent.click(screen.getByRole('button', { name: /Le relief du cordage/ }))
  expect(screen.getByAltText('Échantillon réel PI-RP-060')).toBeInTheDocument()
  expect(photo).toHaveAttribute('src', src!)
  expect(
    screen.getByText(/Les possibilités seront vérifiées/),
  ).toBeInTheDocument()
})
it('le menu mobile se referme avec Escape et restitue le focus', () => {
  render(<ProjectHome />)
  const button = screen.getByRole('button', { name: 'Ouvrir le menu' })
  fireEvent.click(button)
  const menu = screen.getByRole('navigation', { name: 'Navigation mobile' })
  fireEvent.keyDown(menu, { key: 'Escape' })
  expect(
    screen.queryByRole('navigation', { name: 'Navigation mobile' }),
  ).not.toBeInTheDocument()
  expect(button).toHaveFocus()
})
