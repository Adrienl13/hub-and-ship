import type { CartItem } from '@/lib/order'
import type { ProductCategory } from '@/lib/products'

// ISO 20-foot "High Cube" standard internal dimensions.
//   length × width × height = 5.898 × 2.352 × 2.700  ≈  37.5 m³
// The extra 30 cm of ceiling vs a regular 20' DV unlocks a real second
// stacking layer: a chair stack (1.92 m) plus two table layers
// (2 × 0.39 m + gaps ≈ 0.86 m) finally fits without clipping.
// The DB's `containers.capacity_cbm` (~28 m³ commercial usable) stays
// the source of truth for the fill ratio; the shell here is just the
// physical envelope the packer paves into.
export const CONTAINER_INNER_METERS = {
  length: 5.898,
  width: 2.352,
  height: 2.700,
} as const

const GAP = 0.04
const CHAIR_STACK_UNITS = 10
// Real-world stackable chair footprint (cm → m): ~52 × 58 cm with the
// stack of 10 reaching about 1.20 m tall (each chair adds ~12 cm on
// top of the seated base). Sized this way, a 20' HC fits 4 stacks
// across × 9 along its length = 36 stacks = 360 chairs — in line with
// Container Club's 350–400 chairs/container target.
const CHAIR_FOOTPRINT_LENGTH = 0.58
const CHAIR_FOOTPRINT_WIDTH = 0.52
const CHAIR_STACK_HEIGHT = 1.2

// Tables ship disassembled in a flat package: a 70×70 cm bistro top
// with its single-leg bundle measures ~72 × 17 × 74 cm (user-provided
// real-world dimensions). We render one package per table instead of
// a "pallet of N" — the flat profile means 12 layers stack neatly
// under the 2.7 m HC ceiling, and the visual stays an actual table
// rather than an opaque crate.
const TABLE_FLAT_HEIGHT = 0.17

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

interface PlacedRect {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly l: number
  readonly h: number
  readonly w: number
  readonly category: ProductCategory
}

interface ExtremePoint {
  readonly x: number
  readonly y: number
  readonly z: number
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
    // A stack of 10 stackable chairs has the footprint of a single
    // chair (assise + dossier) and rises ~1.2 m. Using the chair's own
    // real dimensions — instead of a wider "crate" — lets us pack 4
    // stacks across the width and 9 along the length of a 20' HC,
    // which lines up with the 350–400 chairs/container industry norm.
    return {
      unitsPerPackage: CHAIR_STACK_UNITS,
      size: {
        length: CHAIR_FOOTPRINT_LENGTH,
        height: CHAIR_STACK_HEIGHT,
        width: CHAIR_FOOTPRINT_WIDTH,
      },
      stackableLayers: Math.max(
        1,
        Math.floor(
          CONTAINER_INNER_METERS.height / (CHAIR_STACK_HEIGHT + GAP),
        ),
      ),
    }
  }

  if (product.category === 'table') {
    // Flat disassembled package (real Container Club spec: a 70×70 cm
    // bistro top with its leg bundle = 72 × 17 × 74 cm). Footprint
    // tracks the product's own top dimensions; the height is the
    // disassembled package height, not the assembled 73 cm.
    const length = round3(product.dimensions.l / 100 + 0.02)
    const width = round3(product.dimensions.w / 100 + 0.04)
    const height = TABLE_FLAT_HEIGHT
    return {
      unitsPerPackage: 1,
      size: { length, height, width },
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
  // Three-tier sort tuned for "real container loading":
  //   1. Chair stacks + benches first. They are tall/long and stable —
  //      they belong on the floor as the load's base.
  //   2. Tables next. They are short and flat, so they slide onto the
  //      gap *above* a chair stack (chair 1.92 m + table 0.39 m fits
  //      under the 2.40 m ceiling) — exactly what users expect to see
  //      "stacked on top".
  //   3. Armchairs last. Their armrests + curved seats can't support
  //      anything, so we want them tucked into leftover gaps instead of
  //      blocking prime floor real estate.
  // Within a tier, volume-desc decides which big-and-stable item lands
  // first — same effect as best-fit-decreasing.
  return [...drafts].sort((a, b) => {
    const tierDelta = packingTier(a.category) - packingTier(b.category)
    if (tierDelta !== 0) return tierDelta

    const volA = a.size.length * a.size.height * a.size.width
    const volB = b.size.length * b.size.height * b.size.width
    if (Math.abs(volB - volA) > 0.001) return volB - volA

    const lengthDelta = b.size.length - a.size.length
    if (Math.abs(lengthDelta) > 0.001) return lengthDelta

    const heightDelta = b.size.height - a.size.height
    if (Math.abs(heightDelta) > 0.001) return heightDelta

    return a.originalIndex - b.originalIndex
  })
}

function packingTier(category: ProductCategory): number {
  if (category === 'chair' || category === 'bench') return 0
  if (category === 'table') return 1
  return 2
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - 0.001 && b0 < a1 - 0.001
}

function rectsOverlap(a: PlacedRect, b: PlacedRect): boolean {
  return (
    intervalsOverlap(a.x, a.x + a.l, b.x, b.x + b.l) &&
    intervalsOverlap(a.y, a.y + a.h, b.y, b.y + b.h) &&
    intervalsOverlap(a.z, a.z + a.w, b.z, b.z + b.w)
  )
}

function tryPlaceAt({
  draft,
  point,
  placed,
  l,
  w,
}: {
  readonly draft: PackageDraft
  readonly point: ExtremePoint
  readonly placed: ReadonlyArray<PlacedRect>
  readonly l: number
  readonly w: number
}): PlacedRect | null {
  const candidate: PlacedRect = {
    x: point.x,
    y: point.y,
    z: point.z,
    l,
    h: draft.size.height,
    w,
    category: draft.category,
  }

  if (
    candidate.x + candidate.l > CONTAINER_INNER_METERS.length + 0.001 ||
    candidate.y + candidate.h > CONTAINER_INNER_METERS.height + 0.001 ||
    candidate.z + candidate.w > CONTAINER_INNER_METERS.width + 0.001
  ) {
    return null
  }

  for (const rect of placed) {
    if (rectsOverlap(candidate, rect)) return null
  }

  // Off-floor candidates need a real flat surface to rest on. Armchairs
  // have armrests + a curved seat — never use one as a base. Tables,
  // benches and chair-pallets are all valid bases.
  if (candidate.y > 0.001) {
    const supports = placed.filter(
      (rect) =>
        Math.abs(rect.y + rect.h + GAP - candidate.y) <= 0.001 &&
        intervalsOverlap(
          candidate.x,
          candidate.x + candidate.l,
          rect.x,
          rect.x + rect.l,
        ) &&
        intervalsOverlap(
          candidate.z,
          candidate.z + candidate.w,
          rect.z,
          rect.z + rect.w,
        ),
    )
    if (supports.length === 0) return null
    if (supports.some((rect) => rect.category === 'armchair')) return null
  }

  return candidate
}

/** Try the draft both in its natural orientation and rotated 90° around
 *  the vertical axis (length ↔ width swap). Returns the first variant
 *  that fits — natural orientation wins ties so visual identity stays
 *  predictable when there's no need to rotate. */
function tryPlaceAtWithRotation({
  draft,
  point,
  placed,
}: {
  readonly draft: PackageDraft
  readonly point: ExtremePoint
  readonly placed: ReadonlyArray<PlacedRect>
}): PlacedRect | null {
  const natural = tryPlaceAt({
    draft,
    point,
    placed,
    l: draft.size.length,
    w: draft.size.width,
  })
  if (natural) return natural
  // Skip rotation when the footprint is already square — it would be a
  // no-op and just costs us an overlap check.
  if (Math.abs(draft.size.length - draft.size.width) < 0.001) return null
  return tryPlaceAt({
    draft,
    point,
    placed,
    l: draft.size.width,
    w: draft.size.length,
  })
}

function toPackedPackage({
  draft,
  x,
  y,
  z,
  l,
  h,
  w,
}: {
  readonly draft: PackageDraft
  readonly x: number
  readonly y: number
  readonly z: number
  readonly l: number
  readonly h: number
  readonly w: number
}): PackedPackage {
  return {
    pos: [round3(x), round3(y), round3(z)],
    size: [
      // Slight 3% shrink prevents Z-fighting between adjacent packages
      // while keeping the load looking dense (the old 4% shrink made the
      // container appear half-empty even at 90% fill).
      round3(l * 0.97),
      round3(h * 0.97),
      round3(w * 0.97),
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

/**
 * 3D bin packing — extreme-points heuristic.
 *
 * We maintain a small list of candidate corners (initially just the
 * container origin). For each draft, sorted by volume descending, we try
 * every candidate ordered by altitude ascending, then x, then z — so
 * the floor fills before anything climbs. The first corner that fits
 * (geometry, no overlap, supported by a non-armchair base when off the
 * floor) wins. After placement we add three new candidates at the
 * +x, +y, +z corners of the just-placed box.
 *
 * Why this replaces the old per-column packer:
 *  - The old algorithm cut the container into vertical "columns" whose
 *    length was frozen at the first draft inserted. A later draft just
 *    slightly longer than the column was rejected even when there was
 *    obviously room next door, producing phantom overflow at ~50% fill.
 *  - Extreme points have no per-column geometry. Any draft that fits
 *    anywhere goes anywhere — the container actually fills up.
 */
export function packContainerPackages(
  items: ReadonlyArray<CartItem>,
): PackedContainer {
  const { drafts, accumulators } = createPackageDrafts(items)
  const packages: PackedPackage[] = []
  const placed: PlacedRect[] = []
  const points: ExtremePoint[] = [{ x: 0, y: 0, z: 0 }]
  let overflowUnits = 0
  let overflowPackages = 0

  const overflow: PackageDraft[] = []
  const sorted = sortPackagesForPacking(drafts)

  function attemptPlacement(draft: PackageDraft): {
    placement: PlacedRect
    usedPoint: ExtremePoint
  } | null {
    // Lowest first — floor fills before stacking — then bias toward the
    // length-axis origin so loads visually start from the container door.
    const orderedPoints = [...points].sort(
      (a, b) => a.y - b.y || a.x - b.x || a.z - b.z,
    )
    for (const point of orderedPoints) {
      const result = tryPlaceAtWithRotation({ draft, point, placed })
      if (result) return { placement: result, usedPoint: point }
    }
    return null
  }

  for (const draft of sorted) {
    const attempt = attemptPlacement(draft)

    const accumulator = accumulators[draft.sliceIndex]

    if (attempt) {
      const { placement, usedPoint } = attempt
      placed.push(placement)

      // Remove the corner we just consumed (avoid stale duplicates).
      const idx = points.indexOf(usedPoint)
      if (idx !== -1) points.splice(idx, 1)

      // Drop any corner that's now inside the new package — it can no
      // longer be reached.
      for (let i = points.length - 1; i >= 0; i -= 1) {
        const p = points[i]!
        if (
          p.x >= placement.x - 0.001 &&
          p.x < placement.x + placement.l - 0.001 &&
          p.y >= placement.y - 0.001 &&
          p.y < placement.y + placement.h - 0.001 &&
          p.z >= placement.z - 0.001 &&
          p.z < placement.z + placement.w - 0.001
        ) {
          points.splice(i, 1)
        }
      }

      // Three new candidate corners — to the right, above, and behind.
      const candidates: ExtremePoint[] = [
        {
          x: round3(placement.x + placement.l + GAP),
          y: placement.y,
          z: placement.z,
        },
        {
          x: placement.x,
          y: round3(placement.y + placement.h + GAP),
          z: placement.z,
        },
        {
          x: placement.x,
          y: placement.y,
          z: round3(placement.z + placement.w + GAP),
        },
      ]
      for (const p of candidates) {
        if (
          p.x < CONTAINER_INNER_METERS.length - 0.001 &&
          p.y < CONTAINER_INNER_METERS.height - 0.001 &&
          p.z < CONTAINER_INNER_METERS.width - 0.001 &&
          !points.some(
            (q) =>
              Math.abs(q.x - p.x) < 0.001 &&
              Math.abs(q.y - p.y) < 0.001 &&
              Math.abs(q.z - p.z) < 0.001,
          )
        ) {
          points.push(p)
        }
      }

      const packedBox = toPackedPackage({
        draft,
        l: placement.l,
        h: placement.h,
        w: placement.w,
        x:
          -CONTAINER_INNER_METERS.length / 2 +
          placement.x +
          placement.l / 2,
        y:
          -CONTAINER_INNER_METERS.height / 2 +
          placement.y +
          placement.h / 2,
        z:
          -CONTAINER_INNER_METERS.width / 2 +
          placement.z +
          placement.w / 2,
      })
      packages.push(packedBox)

      if (accumulator) {
        accumulator.packedUnits += draft.units
        accumulator.packageCount += 1
        accumulator.xWeightedSum += packedBox.pos[0] * draft.units
      }
    } else {
      // Hold the draft for a second pass — extreme points evolve as more
      // packages drop, so a draft that didn't fit early might find a
      // corner once the floor settles.
      overflow.push(draft)
    }
  }

  // Second pass: retry the leftovers in the same loop. We keep iterating
  // until a pass plants nothing new (no point in spinning forever).
  let pendingOverflow = overflow
  for (let attempt = 0; attempt < 2 && pendingOverflow.length > 0; attempt += 1) {
    const stillOverflow: PackageDraft[] = []
    for (const draft of pendingOverflow) {
      const result = attemptPlacement(draft)
      if (!result) {
        stillOverflow.push(draft)
        continue
      }
      const { placement, usedPoint } = result
      placed.push(placement)
      const idx = points.indexOf(usedPoint)
      if (idx !== -1) points.splice(idx, 1)
      for (let i = points.length - 1; i >= 0; i -= 1) {
        const p = points[i]!
        if (
          p.x >= placement.x - 0.001 &&
          p.x < placement.x + placement.l - 0.001 &&
          p.y >= placement.y - 0.001 &&
          p.y < placement.y + placement.h - 0.001 &&
          p.z >= placement.z - 0.001 &&
          p.z < placement.z + placement.w - 0.001
        ) {
          points.splice(i, 1)
        }
      }
      const newCorners: ExtremePoint[] = [
        {
          x: round3(placement.x + placement.l + GAP),
          y: placement.y,
          z: placement.z,
        },
        {
          x: placement.x,
          y: round3(placement.y + placement.h + GAP),
          z: placement.z,
        },
        {
          x: placement.x,
          y: placement.y,
          z: round3(placement.z + placement.w + GAP),
        },
      ]
      for (const p of newCorners) {
        if (
          p.x < CONTAINER_INNER_METERS.length - 0.001 &&
          p.y < CONTAINER_INNER_METERS.height - 0.001 &&
          p.z < CONTAINER_INNER_METERS.width - 0.001 &&
          !points.some(
            (q) =>
              Math.abs(q.x - p.x) < 0.001 &&
              Math.abs(q.y - p.y) < 0.001 &&
              Math.abs(q.z - p.z) < 0.001,
          )
        ) {
          points.push(p)
        }
      }
      const packedBox = toPackedPackage({
        draft,
        l: placement.l,
        h: placement.h,
        w: placement.w,
        x:
          -CONTAINER_INNER_METERS.length / 2 + placement.x + placement.l / 2,
        y:
          -CONTAINER_INNER_METERS.height / 2 + placement.y + placement.h / 2,
        z:
          -CONTAINER_INNER_METERS.width / 2 + placement.z + placement.w / 2,
      })
      packages.push(packedBox)
      const accumulator = accumulators[draft.sliceIndex]
      if (accumulator) {
        accumulator.packedUnits += draft.units
        accumulator.packageCount += 1
        accumulator.xWeightedSum += packedBox.pos[0] * draft.units
      }
    }
    if (stillOverflow.length === pendingOverflow.length) break
    pendingOverflow = stillOverflow
  }

  for (const draft of pendingOverflow) {
    overflowUnits += draft.units
    overflowPackages += 1
    const accumulator = accumulators[draft.sliceIndex]
    if (accumulator) accumulator.overflowUnits += draft.units
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
