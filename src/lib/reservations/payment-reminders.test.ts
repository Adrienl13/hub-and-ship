import { describe, expect, it } from 'vitest'

import {
  contactFromSnapshot,
  resolveDueReminders,
  type ReminderCandidate,
} from './payment-reminders'

const NOW = new Date('2026-07-06T12:00:00.000Z')

function candidate(
  overrides: Partial<ReminderCandidate> = {},
): ReminderCandidate {
  return {
    id: 'res-1',
    reference: 'CC-RES-001',
    status: 'pending_reservation_fee',
    createdAt: '2026-07-05T10:00:00.000Z', // 26 h avant NOW
    reminderCount: 0,
    lastReminderAt: null,
    email: 'client@resto.fr',
    contactName: 'Marie',
    payNow: 250,
    ...overrides,
  }
}

describe('resolveDueReminders', () => {
  it('sends the first reminder after 24h, not before', () => {
    const due = resolveDueReminders([candidate()], NOW)
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ stage: 1, expectedReminderCount: 0 })

    const early = resolveDueReminders(
      [candidate({ createdAt: '2026-07-06T02:00:00.000Z' })], // 10 h
      NOW,
    )
    expect(early).toHaveLength(0)
  })

  it('sends the second reminder after 72h with a 24h gap, then stops', () => {
    const base = candidate({
      createdAt: '2026-07-03T06:00:00.000Z', // 78 h
      reminderCount: 1,
      lastReminderAt: '2026-07-04T08:00:00.000Z', // 28 h avant NOW
    })
    expect(resolveDueReminders([base], NOW)[0]).toMatchObject({
      stage: 2,
      expectedReminderCount: 1,
    })

    // Trop tôt après la 1re relance (gap < 24 h).
    expect(
      resolveDueReminders(
        [{ ...base, lastReminderAt: '2026-07-06T00:00:00.000Z' }],
        NOW,
      ),
    ).toHaveLength(0)

    // Plafond atteint : plus jamais de relance.
    expect(
      resolveDueReminders([{ ...base, reminderCount: 2 }], NOW),
    ).toHaveLength(0)
  })

  it('skips paid/cancelled reservations and missing emails', () => {
    expect(
      resolveDueReminders(
        [
          candidate({ status: 'reserved' }),
          candidate({ status: 'cancelled' }),
          candidate({ email: null }),
          candidate({ email: 'pas-un-email' }),
        ],
        NOW,
      ),
    ).toHaveLength(0)
  })
})

describe('contactFromSnapshot', () => {
  it('reads email and name from the JSON snapshot, tolerating junk', () => {
    expect(
      contactFromSnapshot({ email: 'a@b.fr', name: 'Ana', phone: '06' }),
    ).toEqual({ email: 'a@b.fr', name: 'Ana' })
    expect(contactFromSnapshot(null)).toEqual({ email: null, name: null })
    expect(contactFromSnapshot('x')).toEqual({ email: null, name: null })
    expect(contactFromSnapshot({ email: 42 })).toEqual({
      email: null,
      name: null,
    })
  })
})
