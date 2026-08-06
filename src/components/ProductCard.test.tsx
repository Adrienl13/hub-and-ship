import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PRODUCTS, type Product } from '@/lib/products'

// Retour client 08/2026 : choisir un coloris doit se VOIR — l'image
// principale de la carte suit le design sélectionné (photo du design en
// priorité, photo produit en repli), et la pastille « Perso » ouvre la
// demande de coloris pré-remplie.

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}))

import { ProductCard } from '@/components/ProductCard'

const BASE = PRODUCTS.find((p) => p.category === 'chair')!
const PRODUCT: Product = {
  ...BASE,
  id: 'test-bistrot',
  name: 'Chaise bistrot test',
  mainImageUrl: '/images/main.webp',
  variants: [
    { ...BASE.variants[0]!, id: 'v-gris', name: 'Chevron gris', imageUrl: '/images/gris.webp' },
    { ...BASE.variants[0]!, id: 'v-vert', name: 'Tressage vert', imageUrl: '/images/vert.webp' },
    { ...BASE.variants[0]!, id: 'v-sans', name: 'Sans photo', imageUrl: undefined },
  ],
}

function renderCard(variantId: string) {
  return render(
    <ProductCard
      product={PRODUCT}
      variantId={variantId}
      qty={0}
      onQtyChange={() => {}}
      onVariantChange={() => {}}
    />,
  )
}

describe('ProductCard — image liée au design', () => {
  it('affiche la photo du design sélectionné', () => {
    renderCard('v-vert')
    const img = screen.getByAltText('Chaise bistrot test — Tressage vert')
    expect(img.getAttribute('src')).toBe('/images/vert.webp')
  })

  it('replie sur la photo produit quand le design n’a pas de photo', () => {
    renderCard('v-sans')
    const img = screen.getByAltText('Chaise bistrot test — Sans photo')
    expect(img.getAttribute('src')).toBe('/images/main.webp')
  })

  it('propose la pastille « Perso » vers la demande de coloris', () => {
    renderCard('v-gris')
    const perso = screen.getByLabelText(
      'Demander un autre coloris pour Chaise bistrot test',
    )
    expect(perso).toBeTruthy()
  })
})
