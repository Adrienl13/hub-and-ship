import { describe, expect, it } from 'vitest'

import {
  isStockPhotoUrl,
  keepAttributableTestimonial,
  keepProofGallery,
  keepProofPhoto,
} from '@/lib/delivered-containers/proof'
import { buildRegistrySitemap } from '@/routes/sitemap-livres[.]xml'

describe('photos du registre', () => {
  it('reconnaît les banques d’images', () => {
    for (const url of [
      'https://images.unsplash.com/photo-1551298370-9d3d53740c72?auto=format&w=1200',
      'https://unsplash.com/photos/abc',
      'https://images.pexels.com/photos/1/x.jpg',
      'https://cdn.pixabay.com/photo/2020/x.jpg',
      'https://picsum.photos/800',
    ]) {
      expect(isStockPhotoUrl(url), url).toBe(true)
    }
  })

  it('laisse passer les vraies photos', () => {
    for (const url of [
      'https://mkfztwibolswqcggukeq.supabase.co/storage/v1/object/public/catalogue-images/containers/1786308760742-arsfdb.jpg',
      '/catalogue/rope-series/ROP-001-01.webp',
      'https://terrassea.com/images/home/hero.webp',
      '',
      null,
    ]) {
      expect(isStockPhotoUrl(url), String(url)).toBe(false)
    }
  })

  it('retire une photo principale de stock plutôt que de la présenter comme preuve', () => {
    expect(keepProofPhoto('https://images.unsplash.com/photo-1')).toBeNull()
    expect(keepProofPhoto('https://cdn.terrassea.fr/a.jpg')).toBe(
      'https://cdn.terrassea.fr/a.jpg',
    )
    expect(keepProofPhoto(null)).toBeNull()
  })

  it('nettoie la galerie sans toucher aux vues authentiques', () => {
    const gallery = [
      { url: 'https://images.unsplash.com/photo-1', caption: 'Inspection SGS' },
      { url: 'https://cdn.terrassea.fr/quai.jpg', caption: 'Quai Fos-sur-Mer' },
      { url: 'https://images.pexels.com/photos/2/x.jpg', caption: 'Terrasse' },
    ]
    expect(keepProofGallery(gallery)).toEqual([gallery[1]])
  })
})

describe('témoignages du registre', () => {
  it('retire une citation que personne ne signe', () => {
    const anonymous = keepAttributableTestimonial({
      quote: 'Très bonne qualité produit.',
      longQuote: 'Version longue.',
      author: null,
      location: 'Marseille',
      rating: 5,
    })
    expect(anonymous.quote).toBeNull()
    expect(anonymous.longQuote).toBeNull()
    // La note et la localisation restent : elles n'affirment rien seules.
    expect(anonymous.rating).toBe(5)
    expect(anonymous.location).toBe('Marseille')
  })

  it('traite un auteur vide comme absent', () => {
    expect(
      keepAttributableTestimonial({ quote: 'Bien', author: '   ' }).quote,
    ).toBeNull()
  })

  it('garde un témoignage signé intact', () => {
    const signed = {
      quote: 'Délais tenus.',
      author: 'Hôtel Le Lavandou',
      rating: 5,
    }
    expect(keepAttributableTestimonial(signed)).toEqual(signed)
  })
})

describe('sitemap du registre', () => {
  it('annonce les fiches publiées avec leur date de livraison', () => {
    const xml = buildRegistrySitemap([
      { slug: 'cc-2026-001', deliveredAt: '2026-03-09' },
      { slug: 'cc-2025-014', deliveredAt: null },
    ])
    expect(xml).toContain('https://terrassea.com/livres/cc-2026-001')
    expect(xml).toContain('<lastmod>2026-03-09</lastmod>')
    expect(xml).toContain('https://terrassea.com/livres/cc-2025-014')
    expect(xml.match(/<url>/g)).toHaveLength(2)
  })

  it('reste un document valide quand rien n’est publié', () => {
    const xml = buildRegistrySitemap([])
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('<url>')
  })

  it('ignore une fiche sans slug plutôt que d’annoncer /livres/', () => {
    expect(
      buildRegistrySitemap([{ slug: '', deliveredAt: null }]),
    ).not.toContain('<url>')
  })
})
