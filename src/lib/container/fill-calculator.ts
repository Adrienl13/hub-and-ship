export interface ContainerFillLine {
  readonly quantity: number
  readonly cbmPerUnit: number
}

export interface ContainerSeriesInput {
  readonly seriesId: string
  readonly unitsCommitted: number
  readonly moqUnits: number
}

export interface ContainerFillResult {
  readonly usedCbm: number
  readonly capacityCbm: number
  readonly remainingCbm: number
  readonly overCapacityCbm: number
  readonly fillPercent: number
  readonly thresholdPercent: number
  readonly thresholdReached: boolean
  readonly totalUnits: number
}

export interface SeriesProgressResult {
  readonly seriesReached: number
  readonly totalSeries: number
  readonly minSeriesRequired: number
  readonly minSeriesReached: boolean
  readonly remainingSeries: number
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function safePositive(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

export function calculateContainerFill(
  lines: ReadonlyArray<ContainerFillLine>,
  capacityCbm: number,
  thresholdPercent = 80,
): ContainerFillResult {
  const safeCapacity = safePositive(capacityCbm)
  const safeThreshold = Math.min(100, Math.max(0, thresholdPercent))
  const usedCbm = round2(
    lines.reduce(
      (sum, line) =>
        sum + safePositive(line.quantity) * safePositive(line.cbmPerUnit),
      0,
    ),
  )
  const totalUnits = Math.trunc(
    lines.reduce((sum, line) => sum + safePositive(line.quantity), 0),
  )
  const rawFillPercent = safeCapacity > 0 ? (usedCbm / safeCapacity) * 100 : 0
  const fillPercent = round2(Math.min(100, rawFillPercent))

  return {
    usedCbm,
    capacityCbm: safeCapacity,
    remainingCbm: round2(Math.max(0, safeCapacity - usedCbm)),
    overCapacityCbm: round2(Math.max(0, usedCbm - safeCapacity)),
    fillPercent,
    thresholdPercent: safeThreshold,
    thresholdReached: rawFillPercent >= safeThreshold && safeCapacity > 0,
    totalUnits,
  }
}

export function calculateSeriesProgress(
  series: ReadonlyArray<ContainerSeriesInput>,
  minSeriesRequired: number,
): SeriesProgressResult {
  const safeMinSeriesRequired = Math.max(0, Math.trunc(minSeriesRequired))
  const totalSeries = series.length
  const seriesReached = series.filter(
    (item) => safePositive(item.unitsCommitted) >= safePositive(item.moqUnits),
  ).length

  return {
    seriesReached,
    totalSeries,
    minSeriesRequired: safeMinSeriesRequired,
    minSeriesReached: seriesReached >= safeMinSeriesRequired,
    remainingSeries: Math.max(0, safeMinSeriesRequired - seriesReached),
  }
}
