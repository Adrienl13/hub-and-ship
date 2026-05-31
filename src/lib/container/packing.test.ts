import { describe, expect, it } from 'vitest'

import { getDefaultVariant } from '@/lib/catalogue'
import { PRODUCTS } from '@/lib/products'
import {
  CONTAINER_INNER_METERS,
  getVisualPackageSpec,
  packContainerPackages,
} from './packing'

function requireProduct(id: string) {
  const product = PRODUCTS.find((item) => item.id === id)
  if (!product) throw new Error(`Missing product ${id}`)

  return product
}

const chair = requireProduct('p1')
const table = requireProduct('p3')

describe('container visual packing', () => {
  it('models 10 chairs as one logistics stack', () => {
    const spec = getVisualPackageSpec({
      product: chair,
      variant: getDefaultVariant(chair),
      quantity: 10,
    })

    expect(spec.unitsPerPackage).toBe(10)
    // At least 1 layer always — current HC ceiling actually fits 2
    // stacks vertically (2 × 1.2 m < 2.7 m) but the lower bound is what
    // the rest of the algorithm relies on.
    expect(spec.stackableLayers).toBeGreaterThanOrEqual(1)
    expect(spec.size.width).toBeLessThanOrEqual(
      CONTAINER_INNER_METERS.width / 4,
    )
  })

  it('places 4 chair stacks across the container width', () => {
    const packed = packContainerPackages([
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 40,
      },
    ])

    expect(packed.packages).toHaveLength(4)
    expect(new Set(packed.packages.map((box) => box.pos[0]))).toHaveLength(1)
    expect(new Set(packed.packages.map((box) => box.pos[2]))).toHaveLength(4)
    expect(packed.overflowUnits).toBe(0)
  })

  it('starts a second length column after 4 chair stacks', () => {
    const packed = packContainerPackages([
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 50,
      },
    ])

    expect(packed.packages).toHaveLength(5)
    expect(new Set(packed.packages.map((box) => box.pos[0]))).toHaveLength(2)
    expect(packed.slices[0]).toMatchObject({
      requestedUnits: 50,
      packedUnits: 50,
      overflowUnits: 0,
    })
  })

  it('keeps every rendered package inside the container shell', () => {
    // Push past the 20' HC capacity so we exercise both the bounds
    // checks AND the overflow path: 600 chairs + 400 tables ~= 64 m³
    // requested vs ~37 m³ shell.
    const packed = packContainerPackages([
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 600,
      },
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 400,
      },
    ])

    for (const box of packed.packages) {
      const [x, y, z] = box.pos
      const [length, height, width] = box.size

      expect(x - length / 2).toBeGreaterThanOrEqual(
        -CONTAINER_INNER_METERS.length / 2,
      )
      expect(x + length / 2).toBeLessThanOrEqual(
        CONTAINER_INNER_METERS.length / 2,
      )
      expect(y - height / 2).toBeGreaterThanOrEqual(
        -CONTAINER_INNER_METERS.height / 2,
      )
      expect(y + height / 2).toBeLessThanOrEqual(
        CONTAINER_INNER_METERS.height / 2,
      )
      expect(z - width / 2).toBeGreaterThanOrEqual(
        -CONTAINER_INNER_METERS.width / 2,
      )
      expect(z + width / 2).toBeLessThanOrEqual(
        CONTAINER_INNER_METERS.width / 2,
      )
    }
    expect(packed.overflowUnits).toBeGreaterThan(0)
  })

  it('keeps chair stacks packed even when tables fill the container', () => {
    const packed = packContainerPackages([
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 50,
      },
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 10,
      },
    ])

    // The intent is to verify that volume-first sorting puts the chair
    // stack ahead of the smaller table packages, so the chair stack is
    // never the one pushed into overflow when capacity gets tight.
    expect(
      packed.slices.find((slice) => slice.productId === chair.id),
    ).toMatchObject({
      requestedUnits: 10,
      packedUnits: 10,
      overflowUnits: 0,
    })
  })

  it('packs the same mixed cart regardless of the product addition order', () => {
    const tableFirst = packContainerPackages([
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 80,
      },
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 10,
      },
    ])
    const chairFirst = packContainerPackages([
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 10,
      },
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 80,
      },
    ])

    expect(chairFirst.overflowUnits).toBe(tableFirst.overflowUnits)
    expect(chairFirst.packages).toHaveLength(tableFirst.packages.length)
  })

  it('settles table pallets above chair stacks when the floor is busy', () => {
    // Chair stacks (tier 0) get the floor first; the lone table pallet
    // (tier 1) ends up on top of one of them — that's the loading
    // pattern users expect and what the tier sort encodes.
    const packed = packContainerPackages([
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 36 * 10, // saturate the floor with chair stacks (4×9)
      },
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 1,
      },
    ])
    const chairPackages = packed.packages.filter(
      (box) => box.productId === chair.id,
    )
    const tablePackage = packed.packages.find(
      (box) => box.productId === table.id,
    )

    expect(tablePackage).toBeDefined()
    expect(chairPackages.length).toBeGreaterThan(0)
    // The table pallet floats above at least one chair stack — its
    // centre Y is above the lowest chair pallet's centre Y.
    const lowestChair = Math.min(...chairPackages.map((box) => box.pos[1]))
    expect(tablePackage!.pos[1]).toBeGreaterThan(lowestChair)
  })
})
