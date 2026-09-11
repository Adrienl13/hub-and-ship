import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProjectHome } from './ProjectHome'
const flag = vi.hoisted(() => ({ enabled: true }))
vi.mock('@/lib/studio/flags', () => ({ isStudioEnabled: () => flag.enabled }))
beforeEach(() => {
  flag.enabled = true
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
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

it('affiche la plaque Terrassea et permet de parcourir les vrais modèles sans recoloration', () => {
  render(<ProjectHome />)
  expect(screen.getByAltText('Terrassea — plaque dorée')).toHaveAttribute(
    'src',
    '/brand/terrassea-logo.svg',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Modèle suivant' }))
  expect(screen.getByText('Tressage rosé')).toBeVisible()
  expect(
    screen.getByAltText('Tressage rosé, photographie catalogue originale'),
  ).toHaveAttribute('src', '/catalogue/bistro-seating-clean/BIS-006-01.webp')
  expect(
    screen.queryByRole('button', { name: 'Mettre les modèles en pause' }),
  ).not.toBeInTheDocument()
})

it('explique le regroupement sans promettre une économie ni certifier les inspirations', () => {
  render(<ProjectHome />)
  expect(screen.getByText(/Images d’inspiration/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Les volumes réunis/ }))
  expect(screen.getByText(/mutualiser le transport/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Votre devis/ }))
  expect(screen.getByText(/Le prix final dépend/)).toBeVisible()
  expect(
    screen.getByRole('link', { name: /Comprendre notre modèle de prix/ }),
  ).toHaveAttribute('href', '/prix')
})

it('présente plusieurs familles sans modifier la sélection du projet', () => {
  render(<ProjectHome />)
  fireEvent.click(screen.getByRole('button', { name: 'Lounge' }))
  expect(screen.getByText('Amalfi · lounge')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Tables' }))
  expect(screen.getByText('Siena · table en situation')).toBeVisible()
  expect(
    screen.getByTestId('featured-model').querySelector('img'),
  ).toHaveAttribute('src', '/catalogue/bistro-seating-clean/BIS-036-01.webp')
})
