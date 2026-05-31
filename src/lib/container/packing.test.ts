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
    const packed = packContainerPackages([
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 300,
      },
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 80,
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

  it('stacks chair pallets on top of tables to reclaim vertical space', () => {
    // With the tier-based sort, tables are placed first as stable bases,
    // then the chair stacks layer on top — that's the realistic loading
    // pattern (flat plywood crates of 10 chairs banded onto a table
    // platform) and the only way the container reaches a useful fill
    // ratio when the mix has both products.
    const packed = packContainerPackages([
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 1,
      },
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 40,
      },
    ])
    const chairPackages = packed.packages.filter(
      (box) => box.productId === chair.id,
    )
    const tablePackage = packed.packages.find(
      (box) => box.productId === table.id,
    )

    expect(tablePackage).toBeDefined()
    expect(chairPackages).toHaveLength(4)
    // The table sits on the floor (negative Y, near container bottom),
    // and at least one chair stack lands above it.
    expect(tablePackage?.pos[1]).toBeLessThan(0)
    const highestChair = Math.max(...chairPackages.map((box) => box.pos[1]))
    expect(highestChair).toBeGreaterThan(tablePackage!.pos[1])
    expect(packed.overflowUnits).toBe(0)
  })
})
