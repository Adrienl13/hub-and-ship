import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { seat } from '@/lib/studio/fixtures.test-helpers'

import { DecisionCard } from './DecisionCard'

const product = seat('bis-001', { name: 'Chaise RIVOLI', basePriceHt: 62 })

function renderCard(
  overrides: Partial<React.ComponentProps<typeof DecisionCard>> = {},
) {
  const handlers = {
    onLike: vi.fn(),
    onDislike: vi.fn(),
    onPass: vi.fn(),
    onUndo: vi.fn(),
    onDetails: vi.fn(),
  }
  render(
    <DecisionCard
      product={product}
      position={2}
      {...handlers}
      {...overrides}
    />,
  )
  return handlers
}

describe('DecisionCard', () => {
  it('affiche image, nom, matière, une spécification et les trois actions visibles', () => {
    renderCard()
    expect(screen.getByRole('img', { name: 'Chaise RIVOLI' })).toHaveAttribute(
      'loading',
      'eager',
    )
    expect(
      screen.getByRole('heading', { name: 'Chaise RIVOLI' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Chaise · Tressage PE')).toBeInTheDocument()
    expect(screen.getByText('48 × 56 × 86 cm')).toBeInTheDocument()
    expect(screen.getByText('Choix 3')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveAccessibleName(
      'Choix 3 : Chaise RIVOLI',
    )
    expect(screen.getByRole('article').textContent).not.toMatch(
      /\d+\s*\/\s*\d+/,
    )
    expect(
      screen.getByRole('button', { name: 'Pas pour moi : Chaise RIVOLI' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Passer : Chaise RIVOLI' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: "J'aime : Chaise RIVOLI" }),
    ).toBeVisible()
  })

  it('ne montre jamais le prix pendant la découverte', () => {
    renderCard()
    expect(screen.queryByText(/62/)).toBeNull()
    expect(screen.queryByText(/€/)).toBeNull()
  })

  it('les boutons ont une zone tactile ≥ 44 px et des aria-label', () => {
    renderCard()
    for (const name of [
      'Pas pour moi : Chaise RIVOLI',
      'Passer : Chaise RIVOLI',
      "J'aime : Chaise RIVOLI",
    ]) {
      const button = screen.getByRole('button', { name })
      expect(button.className).toMatch(/min-h-\[48px\]/)
      expect(button.className).toMatch(/min-w-\[44px\]/)
      expect(button).toHaveAttribute('aria-keyshortcuts')
    }
  })

  it('déclenche les callbacks au clic', async () => {
    const user = userEvent.setup()
    const handlers = renderCard()
    await user.click(
      screen.getByRole('button', { name: "J'aime : Chaise RIVOLI" }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Pas pour moi : Chaise RIVOLI' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Passer : Chaise RIVOLI' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Voir les détails de Chaise RIVOLI' }),
    )
    expect(handlers.onLike).toHaveBeenCalledTimes(1)
    expect(handlers.onDislike).toHaveBeenCalledTimes(1)
    expect(handlers.onPass).toHaveBeenCalledTimes(1)
    expect(handlers.onDetails).toHaveBeenCalledTimes(1)
  })

  it('raccourcis clavier : ← pas pour moi, ↓ passer, → j’aime, Z annuler, D détails', () => {
    const handlers = renderCard()
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'z' })
    fireEvent.keyDown(document, { key: 'd' })
    expect(handlers.onLike).toHaveBeenCalledTimes(1)
    expect(handlers.onDislike).toHaveBeenCalledTimes(1)
    expect(handlers.onPass).toHaveBeenCalledTimes(1)
    expect(handlers.onUndo).toHaveBeenCalledTimes(1)
    expect(handlers.onDetails).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Clavier/)).toBeInTheDocument()
  })

  it('les raccourcis sont ignorés dans un champ de saisie et quand désactivés', () => {
    const handlers = renderCard({ shortcutsEnabled: false })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(handlers.onLike).not.toHaveBeenCalled()

    const enabled = renderCard()
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(enabled.onLike).not.toHaveBeenCalled()
    input.remove()
  })

  it('navigation clavier : les actions sont dans l’ordre Pas pour moi → Passer → J’aime', async () => {
    const user = userEvent.setup()
    renderCard()
    const details = screen.getByRole('button', {
      name: 'Voir les détails de Chaise RIVOLI',
    })
    details.focus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Pas pour moi : Chaise RIVOLI' }),
    ).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Passer : Chaise RIVOLI' }),
    ).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: "J'aime : Chaise RIVOLI" }),
    ).toHaveFocus()
  })

  it('reduced motion : l’animation d’entrée est conditionnée à motion-safe', () => {
    renderCard()
    const article = screen.getByRole('article')
    expect(article.className).toContain('motion-safe:animate-fade-in')
    expect(article.className).not.toMatch(/(^|\s)animate-fade-in/)
  })
})

it('sert les deux résolutions du même Decision Image validé', () => {
  renderCard({
    product: {
      ...product,
      decisionImageUrl: 'https://example.test/1200.webp',
      decisionThumbUrl: 'https://example.test/600.webp',
    },
  })
  expect(screen.getByRole('img', { name: product.name })).toHaveAttribute(
    'srcset',
    'https://example.test/600.webp 600w, https://example.test/1200.webp 1200w',
  )
})
