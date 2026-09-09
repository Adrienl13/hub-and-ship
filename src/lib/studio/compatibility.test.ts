import { describe, it, expect } from 'vitest'
import { resolveTableCompatibility as resolve } from './compatibility'
import { top, base, pair, data } from './table.test-helpers'
const empty = { ...data, rules: [] }
describe('compatibilité Studio conservatrice', () => {
  it('exception allowed / denied prioritaire', () => {
    expect(resolve(top, base, data).verdict).toBe('allowed')
    expect(
      resolve(
        top,
        { ...base, compatibleTopShapes: ['rectangular'] },
        { ...data, rules: [{ ...pair, verdict: 'denied' }] },
      ).verdict,
    ).toBe('denied')
  })
  it('types vérifiés, forme et dimensions maximales', () => {
    const typed = {
      ...data,
      baseProfiles: [{ base_id: base.id, base_type_id: 'central' }],
      rules: [
        {
          ...pair,
          base_id: null,
          tabletop_id: null,
          base_type_id: 'central',
          shape: 'rectangular' as const,
          max_length_cm: 80,
          max_width_cm: 70,
        },
      ],
    }
    expect(resolve(top, base, typed).verdict).toBe('allowed')
    expect(
      resolve({ ...top, dimensions: { l: 90, w: 70, h: 2 } }, base, typed)
        .verdict,
    ).toBe('denied')
    expect(resolve({ ...top, tableShape: 'round' }, base, typed).verdict).toBe(
      'denied',
    )
    expect(
      resolve(top, base, {
        ...typed,
        rules: [...typed.rules, { ...pair, verdict: 'denied' }],
      }).verdict,
    ).toBe('denied')
  })
  it('liste catalogue non vide seulement', () => {
    expect(
      resolve(top, { ...base, compatibleTopShapes: ['rectangular'] }, empty)
        .verdict,
    ).toBe('allowed')
    expect(
      resolve(top, { ...base, compatibleTopShapes: ['round'] }, empty).verdict,
    ).toBe('denied')
    expect(resolve(top, base, empty).verdict).toBe('requires_confirmation')
  })
  it('données manquantes et lecture indisponible ne certifient rien', () => {
    expect(resolve(undefined, base, data).verdict).toBe('requires_confirmation')
    expect(
      resolve({ ...top, dimensions: { l: 0, w: 70, h: 2 } }, base, empty)
        .verdict,
    ).toBe('requires_confirmation')
    expect(
      resolve(
        top,
        { ...base, compatibleTopShapes: ['rectangular'] },
        { ...data, available: false },
      ).verdict,
    ).toBe('requires_confirmation')
  })
  it('produits inactifs refusés même avec exception', () => {
    expect(resolve({ ...top, isActive: false }, base, data).verdict).toBe(
      'denied',
    )
    expect(resolve(top, { ...base, isActive: false }, data).verdict).toBe(
      'denied',
    )
  })
  it('aucune déduction du nom ou SKU', () => {
    expect(
      resolve(
        top,
        { ...base, name: 'Compatible HPL 70x70 universel', sku: 'TOP-70-ALL' },
        empty,
      ).verdict,
    ).toBe('requires_confirmation')
  })
  it('conflits refusés', () =>
    expect(
      resolve(top, base, {
        ...data,
        rules: [pair, { ...pair, id: 'conflict', verdict: 'denied' }],
      }).verdict,
    ).toBe('requires_confirmation'))
})
