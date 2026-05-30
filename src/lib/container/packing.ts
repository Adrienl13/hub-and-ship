import type { CartItem } from '@/lib/order'
import type { ProductCategory } from '@/lib/products'

export const CONTAINER_INNER_METERS = {
  length: 5.9,
  width: 2.34,
  height: 2.69,
} as const

const GAP = 0.04
const CHAIR_STACK_UNITS = 10
const CHAIR_STACKS_ACROSS_WIDTH = 4

/** Deterministic HSL colour from a stable string (variant id) — used only
 * for the container-packing visualisation so distinct designs render as
 * distinct blocks. Not a brand colour; replaces the former `variant.hex`. */
function colourFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  const hue = Math.abs(h) % 360
  return `hsl(${hue}, 38%, 55%)`
}

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

interface PackageDraft {
  readonly size: PackageSizeMeters
  readonly category: ProductCategory
  readonly color: string
  readonly productId: string
  readonly productName: string
  readonly units: number
  readonly packageIndex: number
  readonly sliceIndex: number
  readonly originalIndex: number
}

interface PackingRect {
  readonly y: number
  readonly z: number
  readonly height: number
  readonly width: number
  readonly category: ProductCategory
}

interface PackingColumn {
  readonly index: number
  readonly xStart: number
  readonly length: number
  readonly rects: PackingRect[]
}

interface SliceAccumulator {
  readonly productId: string
  readonly productName: string
  readonly color: string
  readonly requestedUnits: number
  packedUnits: number
  overflowUnits: number
  packageCount: number
  xWeightedSum: number
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
        length: Math.max(
          0.8,
          packageLengthFromCbm({ cbm: stackCbm, width, height }),
        ),
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

function createPackageDrafts(items: ReadonlyArray<CartItem>): {
  readonly drafts: ReadonlyArray<PackageDraft>
  readonly accumulators: SliceAccumulator[]
} {
  const drafts: PackageDraft[] = []
  const accumulators: SliceAccumulator[] = []
  let originalIndex = 0

  items.forEach((item, sliceIndex) => {
    if (item.quantity <= 0) return

    const spec = getVisualPackageSpec(item)
    const packageCount = Math.ceil(item.quantity / spec.unitsPerPackage)
    const accumulator: SliceAccumulator = {
      productId: item.product.id,
      productName: item.product.name,
      color: colourFromId(item.variant.id),
      requestedUnits: item.quantity,
      packedUnits: 0,
      overflowUnits: 0,
      packageCount: 0,
      xWeightedSum: 0,
    }
    accumulators[sliceIndex] = accumulator

    for (let packageIndex = 0; packageIndex < packageCount; packageIndex++) {
      const remainingUnits = item.quantity - packageIndex * spec.unitsPerPackage
      drafts.push({
        size: spec.size,
        category: item.product.category,
        color: colourFromId(item.variant.id),
        productId: item.product.id,
        productName: item.product.name,
        units: Math.min(spec.unitsPerPackage, remainingUnits),
        packageIndex,
        sliceIndex,
        originalIndex,
      })
      originalIndex += 1
    }
  })

  return {
    drafts,
    accumulators,
  }
}

function sortPackagesForPacking(
  drafts: ReadonlyArray<PackageDraft>,
): ReadonlyArray<PackageDraft> {
  return [...drafts].sort((a, b) => {
    const supportDelta =
      supportPriority(a.category) - supportPriority(b.category)
    if (supportDelta !== 0) return supportDelta

    const lengthDelta = b.size.length - a.size.length
    if (Math.abs(lengthDelta) > 0.001) return lengthDelta

    const heightDelta = b.size.height - a.size.height
    if (Math.abs(heightDelta) > 0.001) return heightDelta

    const widthDelta = b.size.width - a.size.width
    if (Math.abs(widthDelta) > 0.001) return widthDelta

    return a.originalIndex - b.originalIndex
  })
}

function supportPriority(category: ProductCategory): number {
  if (category === 'chair') return 0
  if (category === 'table') return 1
  return 2
}

function zRangesOverlap(
  a: { readonly z: number; readonly width: number },
  b: { readonly z: number; readonly width: number },
): boolean {
  return a.z < b.z + b.width - 0.001 && b.z < a.z + a.width - 0.001
}

function canUseVerticalCandidate({
  column,
  draft,
  y,
  z,
}: {
  readonly column: PackingColumn
  readonly draft: PackageDraft
  readonly y: number
  readonly z: number
}): boolean {
  if (y <= 0.001) return true

  if (draft.category === 'chair') return false
  if (draft.category !== 'table') return false

  const supports = column.rects.filter(
    (rect) =>
      Math.abs(rect.y + rect.height + GAP - y) <= 0.001 &&
      zRangesOverlap(
        { z, width: draft.size.width },
        { z: rect.z, width: rect.width },
      ),
  )

  if (supports.length === 0) return false

  return supports.every(
    (rect) => rect.category === 'chair' || rect.category === 'table',
  )
}

function tryPlaceInColumn(
  column: PackingColumn,
  draft: PackageDraft,
): PackedPackage | null {
  if (draft.size.length > column.length + 0.001) return null

  const yEdges = new Set([0])
  const zEdges = new Set([0])

  for (const rect of column.rects) {
    yEdges.add(round3(rect.y + rect.height + GAP))
    zEdges.add(round3(rect.z + rect.width + GAP))
  }

  const candidates = [...yEdges].flatMap((y) =>
    [...zEdges].map((z) => ({ y, z })),
  )

  candidates.sort((a, b) => a.y - b.y || a.z - b.z)

  for (const candidate of candidates) {
    if (
      candidate.z + draft.size.width > CONTAINER_INNER_METERS.width + 0.001 ||
      candidate.y + draft.size.height > CONTAINER_INNER_METERS.height + 0.001
    ) {
      continue
    }

    if (
      !canUseVerticalCandidate({
        column,
        draft,
        y: candidate.y,
        z: candidate.z,
      })
    ) {
      continue
    }

    const overlaps = column.rects.some((rect) => {
      const separated =
        candidate.z + draft.size.width + GAP <= rect.z + 0.001 ||
        rect.z + rect.width + GAP <= candidate.z + 0.001 ||
        candidate.y + draft.size.height + GAP <= rect.y + 0.001 ||
        rect.y + rect.height + GAP <= candidate.y + 0.001

      return !separated
    })

    if (overlaps) continue

    column.rects.push({
      y: candidate.y,
      z: candidate.z,
      height: draft.size.height,
      width: draft.size.width,
      category: draft.category,
    })

    return toPackedPackage({
      draft,
      x: column.xStart + column.length / 2,
      y:
        -CONTAINER_INNER_METERS.height / 2 +
        candidate.y +
        draft.size.height / 2,
      z: -CONTAINER_INNER_METERS.width / 2 + candidate.z + draft.size.width / 2,
    })
  }

  return null
}

function toPackedPackage({
  draft,
  x,
  y,
  z,
}: {
  readonly draft: PackageDraft
  readonly x: number
  readonly y: number
  readonly z: number
}): PackedPackage {
  return {
    pos: [round3(x), round3(y), round3(z)],
    size: [
      round3(draft.size.length * 0.96),
      round3(draft.size.height * 0.96),
      round3(draft.size.width * 0.96),
    ],
    color: draft.color,
    productId: draft.productId,
    productName: draft.productName,
    units: draft.units,
    packageIndex: draft.packageIndex,
    sliceIndex: draft.sliceIndex,
    sliceCenterX: round3(x),
  }
}

export function packContainerPackages(
  items: ReadonlyArray<CartItem>,
): PackedContainer {
  const packages: PackedPackage[] = []
  const columns: PackingColumn[] = []
  const { drafts, accumulators } = createPackageDrafts(items)
  let nextXStart = -CONTAINER_INNER_METERS.length / 2
  let overflowUnits = 0
  let overflowPackages = 0

  for (const draft of sortPackagesForPacking(drafts)) {
    let placed: PackedPackage | null = null

    for (const column of columns) {
      placed = tryPlaceInColumn(column, draft)
      if (placed) break
    }

    if (!placed) {
      const nextXEnd = nextXStart + draft.size.length
      if (nextXEnd <= CONTAINER_INNER_METERS.length / 2 + 0.001) {
        const column: PackingColumn = {
          index: columns.length,
          xStart: nextXStart,
          length: draft.size.length,
          rects: [],
        }
        columns.push(column)
        nextXStart = nextXEnd + GAP
        placed = tryPlaceInColumn(column, draft)
      }
    }

    const accumulator = accumulators[draft.sliceIndex]

    if (placed && accumulator) {
      accumulator.packedUnits += draft.units
      accumulator.packageCount += 1
      accumulator.xWeightedSum += placed.pos[0] * draft.units
      packages.push(placed)
    } else {
      overflowUnits += draft.units
      overflowPackages += 1
      if (accumulator) accumulator.overflowUnits += draft.units
    }
  }

  return {
    packages,
    slices: accumulators.filter(Boolean).map(
      (accumulator): PackedSlice => ({
        productId: accumulator.productId,
        productName: accumulator.productName,
        centerX:
          accumulator.packedUnits > 0
            ? round3(accumulator.xWeightedSum / accumulator.packedUnits)
            : 0,
        color: accumulator.color,
        requestedUnits: accumulator.requestedUnits,
        packedUnits: accumulator.packedUnits,
        overflowUnits: accumulator.overflowUnits,
        packageCount: accumulator.packageCount,
      }),
    ),
    overflowUnits,
    overflowPackages,
  }
}
