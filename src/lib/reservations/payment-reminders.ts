// Pure decision logic for unpaid-reservation reminders (no DB, fully tested).
// Policy: reservations stuck in `pending_reservation_fee` get at most two
// nudges — J+1 (24 h after creation) and J+3 (72 h after creation, and at
// least 24 h after the first nudge). The server endpoint persists the counter
// with a conditional update so overlapping cron runs cannot double-send.

const HOUR_MS = 3_600_000
export const FIRST_REMINDER_AFTER_HOURS = 24
export const SECOND_REMINDER_AFTER_HOURS = 72
export const MIN_GAP_BETWEEN_REMINDERS_HOURS = 24
export const MAX_REMINDERS = 2

export interface ReminderCandidate {
  readonly id: string
  readonly reference: string
  readonly status: string
  readonly createdAt: string
  readonly reminderCount: number
  readonly lastReminderAt: string | null
  readonly email: string | null
  readonly contactName: string | null
  readonly payNow: number
}

export interface DueReminder {
  readonly id: string
  readonly reference: string
  readonly email: string
  readonly contactName: string | null
  readonly payNow: number
  /** 1 = J+1, 2 = J+3 (dernière relance). */
  readonly stage: 1 | 2
  /** Le compteur attendu en base — condition d'idempotence de l'update. */
  readonly expectedReminderCount: number
}

function hoursSince(iso: string, now: Date): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return (now.getTime() - t) / HOUR_MS
}

export function resolveDueReminders(
  candidates: ReadonlyArray<ReminderCandidate>,
  now: Date,
): ReadonlyArray<DueReminder> {
  const due: DueReminder[] = []

  for (const candidate of candidates) {
    if (candidate.status !== 'pending_reservation_fee') continue
    if (candidate.reminderCount >= MAX_REMINDERS) continue
    if (!candidate.email || !candidate.email.includes('@')) continue

    const age = hoursSince(candidate.createdAt, now)

    if (candidate.reminderCount === 0) {
      if (age < FIRST_REMINDER_AFTER_HOURS) continue
      due.push({
        id: candidate.id,
        reference: candidate.reference,
        email: candidate.email,
        contactName: candidate.contactName,
        payNow: candidate.payNow,
        stage: 1,
        expectedReminderCount: 0,
      })
      continue
    }

    // reminderCount === 1 → seconde et dernière relance.
    if (age < SECOND_REMINDER_AFTER_HOURS) continue
    if (
      candidate.lastReminderAt &&
      hoursSince(candidate.lastReminderAt, now) <
        MIN_GAP_BETWEEN_REMINDERS_HOURS
    ) {
      continue
    }
    due.push({
      id: candidate.id,
      reference: candidate.reference,
      email: candidate.email,
      contactName: candidate.contactName,
      payNow: candidate.payNow,
      stage: 2,
      expectedReminderCount: 1,
    })
  }

  return due
}

/** Extracts email/name from the reservation contact_snapshot JSON column. */
export function contactFromSnapshot(snapshot: unknown): {
  email: string | null
  name: string | null
} {
  if (!snapshot || typeof snapshot !== 'object') {
    return { email: null, name: null }
  }
  const record = snapshot as Record<string, unknown>
  return {
    email: typeof record.email === 'string' ? record.email : null,
    name: typeof record.name === 'string' ? record.name : null,
  }
}
