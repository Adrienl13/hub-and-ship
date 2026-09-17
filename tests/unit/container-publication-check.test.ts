import { describe, expect, it } from 'vitest'

import {
  checkContainerPublication,
  hasBlockingIssue,
  type ContainerPublicationInput,
} from '@/lib/delivered-containers/publication-check'

const SOUND: ContainerPublicationInput = {
  reference: 'CC-2026-001',
  slug: 'cc-2026-001',
  status: 'delivered',
  deliveredAt: '2026-03-09',
  expectedCloseAt: '2026-01-30',
  totalItems: 350,
  professionalsServed: 4,
  productBreakdown: [{ units: 200 }, { units: 150 }],
  photoUrl: 'https://cdn.terrassea.fr/containers/cc-2026-001.jpg',
  gallery: [{ url: 'https://cdn.terrassea.fr/containers/a.jpg' }],
  testimonialQuote: 'Délais tenus.',
  testimonialAuthor: 'Hôtel Le Lavandou',
  timeline: [{ date: '2026-01-30' }, { date: '2026-03-09' }],
}

function fields(input: ContainerPublicationInput): ReadonlyArray<string> {
  return checkContainerPublication(input).map((issue) => issue.field)
}

describe('contrôle avant publication', () => {
  it('laisse passer une fiche cohérente', () => {
    expect(checkContainerPublication(SOUND)).toEqual([])
    expect(hasBlockingIssue([])).toBe(false)
  })

  it('refuse un slug qui désigne une autre référence', () => {
    // Cas réel : CC-2025-014 publié sous « cc-2025-002 ».
    const issues = checkContainerPublication({
      ...SOUND,
      reference: 'CC-2025-014',
      slug: 'cc-2025-002',
    })
    expect(issues[0]?.field).toBe('slug')
    expect(issues[0]?.blocking).toBe(true)
    expect(issues[0]?.message).toContain('cc-2025-014')
  })

  it('refuse un total qui contredit le détail par famille', () => {
    const issues = checkContainerPublication({
      ...SOUND,
      totalItems: 790,
      productBreakdown: [{ units: 24 }, { units: 22 }, { units: 12 }],
    })
    expect(issues[0]?.field).toBe('total_items')
    expect(issues[0]?.message).toContain('790')
    expect(issues[0]?.message).toContain('58')
  })

  it('accepte un détail par famille absent — il n’affirme rien', () => {
    expect(fields({ ...SOUND, productBreakdown: [] })).toEqual([])
  })

  it('refuse des compteurs à zéro sur une page de preuve', () => {
    expect(fields({ ...SOUND, totalItems: 0 })).toContain('total_items')
    expect(fields({ ...SOUND, professionalsServed: 0 })).toContain(
      'professionals_served',
    )
  })

  it('refuse une chronologie impossible', () => {
    // Cas réel : CC-2025-004, livraison au 30/09 et clôture au 29/07… de
    // l'année suivante, avec un statut « en transit ».
    expect(
      fields({
        ...SOUND,
        deliveredAt: '2026-01-01',
        expectedCloseAt: '2026-07-29',
      }),
    ).toContain('delivered_at')

    expect(
      fields({ ...SOUND, deliveredAt: '2099-01-01', expectedCloseAt: null }),
    ).toContain('delivered_at')
  })

  it('signale des étapes dans le désordre sans bloquer', () => {
    const issues = checkContainerPublication({
      ...SOUND,
      timeline: [{ date: '2026-05-18' }, { date: '2026-04-20' }],
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.field).toBe('timeline')
    expect(hasBlockingIssue(issues)).toBe(false)
  })

  it('refuse les photos de banque d’images', () => {
    const issues = checkContainerPublication({
      ...SOUND,
      photoUrl: 'https://images.unsplash.com/photo-1516571748831',
      gallery: [
        { url: 'https://images.unsplash.com/photo-1' },
        { url: 'https://cdn.terrassea.fr/vrai.jpg' },
      ],
    })
    expect(issues.map((i) => i.field)).toEqual(['photo_url', 'gallery'])
    expect(issues.every((i) => i.blocking)).toBe(true)
    expect(issues[1]?.message).toContain('1 vue(s)')
  })

  it('signale un témoignage non signé sans bloquer la publication', () => {
    const issues = checkContainerPublication({
      ...SOUND,
      testimonialAuthor: null,
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.field).toBe('testimonial_author')
    expect(hasBlockingIssue(issues)).toBe(false)
  })
})
