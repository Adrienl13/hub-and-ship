import type { CartItem } from '@/lib/order'

export const CONTAINER_INNER_METERS = {
  length: 5.9,
  width: 2.34,
  height: 2.69,
} as const

const GAP = 0.04
const CHAIR_STACK_UNITS = 10
const CHAIR_STACKS_ACROSS_WIDTH = 4

export interface PackageSizeMeters {
  readonly length: number
  readonly height: number
  readonly width: number
}

export interface PackedPackage {
  readonly pos: [number, number, number]
  readonly size: [number, number, number]
  readonly color: string
  readonly productId: string
  readonly productName: string
  readonly units: number
  readonly packageIndex: number
  readonly sliceIndex: number
  readonly sliceCenterX: number
}

export interface PackedSlice {
  readonly productId: string
  readonly productName: string
  readonly centerX: number
  readonly color: string
  readonly requestedUnits: number
  readonly packedUnits: number
  readonly overflowUnits: number
  readonly packageCount: number
}

export interface PackedContainer {
  readonly packages: ReadonlyArray<PackedPackage>
  readonly slices: ReadonlyArray<PackedSlice>
  readonly overflowUnits: number
  readonly overflowPackages: number
}

interface PackageSpec {
  readonly unitsPerPackage: number
  readonly size: PackageSizeMeters
  readonly stackableLayers: number
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function packageLengthFromCbm({
  cbm,
  width,
  height,
}: {
  readonly cbm: number
  readonly width: number
  readonly height: number
}): number {
  return round3(clamp(cbm / (width * height), 0.35, 2.2))
}

export function getVisualPackageSpec(item: CartItem): PackageSpec {
  const { product } = item
  const unitCbm = Math.max(0.01, product.cbmPerUnit)

  if (product.category === 'chair') {
    const width = round3(
      (CONTAINER_INNER_METERS.width / CHAIR_STACKS_ACROSS_WIDTH) * 0.94,
    )
    const height = round3(CONTAINER_INNER_METERS.height * 0.8)
    const stackCbm = unitCbm * CHAIR_STACK_UNITS

    return {
      unitsPerPackage: CHAIR_STACK_UNITS,
      size: {
        length: packageLengthFromCbm({ cbm: stackCbm, width, height }),
        height,
        width,
      },
      stackableLayers: 1,
    }
  }

  if (product.category === 'table') {
    const length = clamp(product.dimensions.l / 100, 0.8, 1.65)
    const width = clamp(product.dimensions.w / 100, 0.68, 0.82)
    const height = round3(clamp(unitCbm / (length * width), 0.18, 0.42))

    return {
      unitsPerPackage: 1,
      size: {
        length: round3(length),
        height,
        width: round3(width),
      },
      stackableLayers: Math.max(
        1,
        Math.floor(CONTAINER_INNER_METERS.height / (height + GAP)),
      ),
    }
  }

  if (product.category === 'bench') {
    const length = clamp(product.dimensions.l / 100, 1.2, 1.9)
    const width = clamp(product.dimensions.w / 100, 0.5, 0.72)
    const height = round3(clamp(unitCbm / (length * width), 0.32, 0.62))

    return {
      unitsPerPackage: 1,
      size: {
        length: round3(length),
        height,
        width: round3(width),
      },
      stackableLayers: Math.max(
        1,
        Math.floor(CONTAINER_INNER_METERS.height / (height + GAP)),
      ),
    }
  }

  const width = clamp(product.dimensions.w / 100, 0.76, 1.06)
  const height = clamp(product.dimensions.h / 100, 0.72, 1.08)
  const length = packageLengthFromCbm({ cbm: unitCbm, width, height })

  return {
    unitsPerPackage: 1,
    size: {
      length,
      height: round3(height),
      width: round3(width),
    },
    stackableLayers: Math.max(
      1,
      Math.floor(CONTAINER_INNER_METERS.height / (height + GAP)),
    ),
  }
}

export function packContainerPackages(items: ReadonlyArray<CartItem>): PackedContainer {
  const packages: PackedPackage[] = []
  const slices: PackedSlice[] = []
  let xCursor = -CONTAINER_INNER_METERS.length / 2
  let sliceIndex = 0
  let overflowUnits = 0
  let overflowPackages = 0

  for (const item of items) {
    if (item.quantity <= 0) continue

    const spec = getVisualPackageSpec(item)
    const packageCount = Math.ceil(item.quantity / spec.unitsPerPackage)
    const cellsAcrossWidth = Math.max(
      1,
      Math.floor(
        (CONTAINER_INNER_METERS.width + GAP) / (spec.size.width + GAP),
      ),
    )
    const layers = Math.max(1, spec.stackableLayers)
    const packagesPerColumn = cellsAcrossWidth * layers
    const columnsNeeded = Math.ceil(packageCount / packagesPerColumn)
    const sliceWidth = columnsNeeded * (spec.size.length + GAP) - GAP
    const sliceCenterX = xCursor + sliceWidth / 2
    let packedUnits = 0
    let packedPackageCount = 0

    const usedWidth =
      cellsAcrossWidth * spec.size.width + (cellsAcrossWidth - 1) * GAP
    const zStart =
      -CONTAINER_INNER_METERS.width / 2 +
      (CONTAINER_INNER_METERS.width - usedWidth) / 2 +
      spec.size.width / 2

    for (let packageIndex = 0; packageIndex < packageCount; packageIndex++) {
      const columnIndex = Math.floor(packageIndex / packagesPerColumn)
      const withinColumn = packageIndex % packagesPerColumn
      const layerIndex = Math.floor(withinColumn / cellsAcrossWidth)
      const widthIndex = withinColumn % cellsAcrossWidth
      const remainingUnits = item.quantity - packageIndex * spec.unitsPerPackage
      const units = Math.min(spec.unitsPerPackage, remainingUnits)

      const x = xCursor + columnIndex * (spec.size.length + GAP) + spec.size.length / 2
      const y =
        -CONTAINER_INNER_METERS.height / 2 +
        layerIndex * (spec.size.height + GAP) +
        spec.size.height / 2
      const z = zStart + widthIndex * (spec.size.width + GAP)
      const insideLength =
        x - spec.size.length / 2 >= -CONTAINER_INNER_METERS.length / 2 &&
        x + spec.size.length / 2 <= CONTAINER_INNER_METERS.length / 2
      const insideHeight =
        y - spec.size.height / 2 >= -CONTAINER_INNER_METERS.height / 2 &&
        y + spec.size.height / 2 <= CONTAINER_INNER_METERS.height / 2
      const insideWidth =
        z - spec.size.width / 2 >= -CONTAINER_INNER_METERS.width / 2 &&
        z + spec.size.width / 2 <= CONTAINER_INNER_METERS.width / 2

      if (!insideLength || !insideHeight || !insideWidth) {
        overflowUnits += units
        overflowPackages += 1
        continue
      }

      packedUnits += units
      packedPackageCount += 1
      packages.push({
        pos: [round3(x), round3(y), round3(z)],
        size: [
          round3(spec.size.length * 0.96),
          round3(spec.size.height * 0.96),
          round3(spec.size.width * 0.96),
        ],
        color: item.variant.hex,
        productId: item.product.id,
        productName: item.product.name,
        units,
        packageIndex,
        sliceIndex,
        sliceCenterX,
      })
    }

    slices.push({
      productId: item.product.id,
      productName: item.product.name,
      centerX: sliceCenterX,
      color: item.variant.hex,
      requestedUnits: item.quantity,
      packedUnits,
      overflowUnits: item.quantity - packedUnits,
      packageCount: packedPackageCount,
    })

    xCursor += sliceWidth + GAP
    sliceIndex++
  }

  return {
    packages,
    slices,
    overflowUnits,
    overflowPackages,
  }
}
