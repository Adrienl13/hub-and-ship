import { describe, it, expect } from 'vitest'
import { distanceKm, locationSchema } from './showroom'
const row = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Lieu test',
  address: '',
  city: 'Lyon',
  postal_code: '69002',
  city_lat: 45.75,
  city_lng: 4.85,
  latitude: null,
  longitude: null,
  visibility: 'internal',
  publication_agreed: false,
  consent_note: '',
  description: '',
  visit_info: '',
  internal_note: '',
  product_skus: [],
  photo_paths: [],
}
describe('showroom publication and proximity', () => {
  it('accepts a private delivery before photographs or exact pin are available', () =>
    expect(locationSchema.safeParse(row).success).toBe(true))
  it('requires explicit recorded consent for either publication mode', () => {
    for (const visibility of ['public', 'on_request'])
      expect(locationSchema.safeParse({ ...row, visibility }).success).toBe(
        false,
      )
    expect(
      locationSchema.safeParse({
        ...row,
        visibility: 'on_request',
        publication_agreed: true,
        consent_note: 'Accord du 16/09',
      }).success,
    ).toBe(true)
  })
  it('public address needs a confirmed exact pin', () => {
    const value = {
      ...row,
      visibility: 'public',
      publication_agreed: true,
      consent_note: 'Accord',
      address: '1 rue test',
    }
    expect(locationSchema.safeParse(value).success).toBe(false)
    expect(
      locationSchema.safeParse({ ...value, latitude: 45.7, longitude: 4.8 })
        .success,
    ).toBe(true)
  })
  it('rejects malformed or foreign photo associations', () =>
    expect(
      locationSchema.safeParse({
        ...row,
        photo_paths: ['someone-else/photo.jpg'],
      }).success,
    ).toBe(false))
  it('computes distance for radius searches including overseas coordinates', () => {
    expect(
      distanceKm(
        { latitude: 48.8566, longitude: 2.3522 },
        { latitude: 45.764, longitude: 4.8357 },
      ),
    ).toBeGreaterThan(380)
    expect(
      distanceKm(
        { latitude: 48.8566, longitude: 2.3522 },
        { latitude: 45.764, longitude: 4.8357 },
      ),
    ).toBeLessThan(400)
    expect(
      distanceKm(
        { latitude: -21.1, longitude: 55.5 },
        { latitude: -21.1, longitude: 55.5 },
      ),
    ).toBe(0)
  })
})
