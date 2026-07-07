// Status-driven reservation timeline. The account reservation model only
// carries the current status (no per-milestone dates), so the timeline is
// derived from status ordering: every step before the current one is done, the
// current step is in progress, the rest are upcoming. Pure + unit tested.

import type { AccountReservationStatus } from '@/lib/account/reservations'

export type TimelineStepState = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly state: TimelineStepState
}

const STEPS: ReadonlyArray<Pick<TimelineStep, 'key' | 'label' | 'description'>> =
  [
    {
      key: 'reserved',
      label: 'Réservation enregistrée',
      description: 'Votre place sur le container est notée.',
    },
    {
      key: 'fee',
      label: 'Frais de réservation réglés',
      description: 'Le paiement des frais valide définitivement la place.',
    },
    {
      key: 'deposit',
      label: 'Acompte 30 %',
      description: 'Appelé lorsque le container atteint son seuil de départ.',
    },
    {
      key: 'production',
      label: 'Production',
      description: 'Fabrication et contrôle qualité en usine.',
    },
    {
      key: 'transit',
      label: 'Transport',
      description: 'Acheminement maritime puis livraison rendue au port.',
    },
    {
      key: 'delivered',
      label: 'Livraison',
      description: 'Réception des pièces et des documents finaux.',
    },
  ]

// Index of the step currently in progress. Steps with a lower index are done;
// a higher index is upcoming. 6 means everything is complete (delivered); a
// negative value means the reservation was cancelled.
const CURRENT_STEP: Record<AccountReservationStatus, number> = {
  pending_reservation_fee: 1,
  reserved: 2,
  deposit_called: 2,
  deposit_paid: 3,
  in_production: 3,
  in_transit: 4,
  delivered: 6,
  cancelled: -1,
}

export function reservationTimelineSteps(
  status: AccountReservationStatus,
): ReadonlyArray<TimelineStep> {
  const current = CURRENT_STEP[status]
  return STEPS.map((step, index) => {
    let state: TimelineStepState
    if (current < 0) state = 'upcoming'
    else if (index < current) state = 'done'
    else if (index === current) state = 'current'
    else state = 'upcoming'
    return { ...step, state }
  })
}

export function isReservationCancelled(
  status: AccountReservationStatus,
): boolean {
  return status === 'cancelled'
}
