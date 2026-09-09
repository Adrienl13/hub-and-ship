import type { StudioProjectItem } from './types'
export function suggestTableQuantity(
  items: ReadonlyArray<StudioProjectItem>,
): number {
  return Math.max(
    1,
    Math.ceil(
      items
        .filter((i) => i.role === 'seat')
        .reduce(
          (n, i) =>
            n +
            (Number.isFinite(i.requestedQuantity)
              ? Math.max(0, i.requestedQuantity)
              : 0),
          0,
        ) / 2,
    ),
  )
}
