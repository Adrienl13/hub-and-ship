import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PublicPage } from './PublicPage'
const destroy = vi.fn()
vi.mock('./start', () => ({ startPage: () => destroy }))
vi.mock('@/components/ContactForm', () => ({
  ContactForm: () => <div>Contact réel</div>,
}))
vi.mock('@/components/partenaires/PartnerForm', () => ({
  PartnerForm: () => <div>Candidature réelle</div>,
}))
vi.mock('@/components/ContainerNotifyForm', () => ({
  ContainerNotifyForm: () => <div>Alerte réelle</div>,
}))
beforeEach(() => destroy.mockClear())
describe('Public pages integration', () => {
  it.each(['home', 'catalogue', 'prix', 'partenaires', 'livres'] as const)(
    'preserves the complete application footer on %s',
    async (kind) => {
      const { container, unmount } = render(<PublicPage kind={kind} />)
      expect(
        screen.getByRole('link', { name: 'Mentions légales' }),
      ).toHaveAttribute('href', '/legal/mentions-legales')
      expect(
        screen.getByRole('button', { name: 'Gérer mes cookies' }),
      ).toBeInTheDocument()
      expect(container.querySelectorAll('footer')).toHaveLength(1)
      expect(container.querySelector('.preview-notice')).toBeNull()
      expect(
        container.querySelector('.public-design')?.textContent,
      ).not.toContain('{{')
      expect(container.textContent).not.toMatch(
        /Témoignage à remplacer|Simulation uniquement|Démonstration :/,
      )
      await waitFor(() =>
        expect(screen.getAllByText('Alerte réelle').length).toBeGreaterThan(0),
      )
      unmount()
      expect(destroy).toHaveBeenCalledOnce()
    },
  )
  it('mounts the existing contact form for project capture', async () => {
    render(<PublicPage kind="home" />)
    expect(await screen.findByText('Contact réel')).toBeInTheDocument()
  })
  it('mounts the existing partner application form', async () => {
    render(<PublicPage kind="partenaires" />)
    expect(await screen.findByText('Candidature réelle')).toBeInTheDocument()
  })
})
