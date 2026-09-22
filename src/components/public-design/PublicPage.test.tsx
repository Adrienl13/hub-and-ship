import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PublicPage } from './PublicPage'
const destroy = vi.fn()
const startPage = vi.fn(() => destroy)
vi.mock('./start', () => ({ startPage }))

// PublicPage charge `./start` par un import différé dans un effet. Un test
// qui rend la page sans attendre cet import laisse la promesse en suspens :
// sur une machine lente (CI), elle se résout APRÈS la fermeture de jsdom, le
// module simulé n'est plus enregistré, et Vitest charge le vrai start.js —
// « Cannot load zod after the environment was torn down ». Chaque rendu
// attend donc que la mise en route ait eu lieu.
async function renderStarted(ui: React.ReactElement) {
  const result = render(ui)
  await waitFor(() => expect(startPage).toHaveBeenCalled())
  return result
}
vi.mock('@/components/ContactForm', () => ({
  ContactForm: () => <div>Contact réel</div>,
}))
vi.mock('@/components/partenaires/PartnerForm', () => ({
  PartnerForm: () => <div>Candidature réelle</div>,
}))
vi.mock('@/components/ContainerNotifyForm', () => ({
  ContainerNotifyForm: () => <div>Alerte réelle</div>,
}))
beforeEach(() => {
  destroy.mockClear()
  startPage.mockClear()
})
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

describe('index catalogue rendu côté serveur', () => {
  const ITEMS = [
    {
      name: 'Chaise de bistrot RIVOLI - chevron blanc / gris',
      path: '/catalogue/p/chaise-de-bistrot-rivoli-bis-001',
      price: '80,00 € HT',
    },
    {
      name: 'Tabouret de bistrot PIGALLE - tressage rose / crème',
      path: '/catalogue/p/tabouret-de-bistrot-pigalle-sku-896',
      price: '82,27 € HT',
    },
  ]

  it('place un lien par fiche dans le balisage de la page', async () => {
    // Sans lui, un robot qui n'exécute pas JavaScript ne lit que
    // « Chargement du catalogue… » : aucun produit, aucun lien interne.
    const { container } = await renderStarted(
      <PublicPage kind="catalogue" catalogueIndex={ITEMS} />,
    )
    const index = container.querySelector('#catalogue-ssr-index')
    expect(index).not.toBeNull()
    const links = index!.querySelectorAll('a')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      '/catalogue/p/chaise-de-bistrot-rivoli-bis-001',
    )
    expect(index!.textContent).toContain('Chaise de bistrot RIVOLI')
    expect(index!.textContent).toContain('82,27 € HT')
  })

  it('ne change rien quand la liste est absente ou vide', async () => {
    // Base injoignable : mieux vaut pas d'index qu'un « Tous nos modèles »
    // sans modèle, que les robots liraient comme un catalogue vide.
    for (const props of [{}, { catalogueIndex: [] }]) {
      startPage.mockClear()
      const { container, unmount } = await renderStarted(
        <PublicPage kind="catalogue" {...props} />,
      )
      expect(container.querySelector('#catalogue-ssr-index')).toBeNull()
      expect(container.innerHTML).not.toContain('catalogue-ssr-index')
      unmount()
    }
  })

  it('n’ajoute rien aux autres pages', async () => {
    const { container } = await renderStarted(
      <PublicPage kind="home" catalogueIndex={ITEMS} />,
    )
    expect(container.querySelector('#catalogue-ssr-index')).toBeNull()
  })
})
