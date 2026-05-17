export interface ReservationFeeConfig {
  readonly rate: number
  readonly min: number
  readonly max: number
}

export const DEFAULT_RESERVATION_FEE_CONFIG: ReservationFeeConfig = {
  rate: 0.03,
  min: 150,
  max: 500,
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateReservationFee(
  subtotalHt: number,
  config: ReservationFeeConfig = DEFAULT_RESERVATION_FEE_CONFIG,
): number {
  if (subtotalHt <= 0) {
    return 0
  }

  const calculated = subtotalHt * config.rate
  const clamped = Math.min(Math.max(calculated, config.min), config.max)

  return round2(clamped)
}
