import { describe, expect, it } from 'vitest'

import {
  evaluateAutoOpen,
  generateNextContainerReference,
  shouldOpenNextContainer,
  type AutoOpenContainerSummary,
} from './auto-open'

const activePort = {
  id: 'port-fos',
  countryCode: 'FR',
  isActive: true,
}

function createContainer(
  overrides: Partial<AutoOpenContainerSummary> = {},
): AutoOpenContainerSummary {
  return {
    id: 'container-1',
    portId: 'port-fos',
    reference: 'CC-2026-001',
    status: 'production',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('container auto-open', () => {
  it('generates the next yearly reference', () => {
    expect(generateNextContainerReference(2026, 0)).toBe('CC-2026-001')
    expect(generateNextContainerReference(2026, 12)).toBe('CC-2026-013')
  })

  it('opens a next container only after the previous one enters operations', () => {
    expect(shouldOpenNextContainer(null)).toBe(true)
    expect(shouldOpenNextContainer(createContainer({ status: 'open' }))).toBe(
      false,
    )
    expect(
      shouldOpenNextContainer(createContainer({ status: 'threshold_reached' })),
    ).toBe(false)
    expect(
      shouldOpenNextContainer(createContainer({ status: 'production' })),
    ).toBe(true)
    expect(
      shouldOpenNextContainer(createContainer({ status: 'delivered' })),
    ).toBe(true)
  })

  it('manual mode suggests a new container without creating it', () => {
    const decision = evaluateAutoOpen({
      mode: 'manual',
      port: activePort,
      openContainersForPort: [],
      lastContainer: createContainer({ status: 'production' }),
      existingCountForYear: 1,
      now: new Date('2026-05-18T08:00:00.000Z'),
    })

    expect(decision).toMatchObject({
      action: 'suggest',
      shouldCreateContainer: false,
      newContainerStatus: null,
      reference: 'CC-2026-002',
    })
    expect(decision.expectedCloseAt?.toISOString()).toBe(
      '2026-06-22T08:00:00.000Z',
    )
  })

  it('semi-auto prepares a draft container for admin approval', () => {
    expect(
      evaluateAutoOpen({
        mode: 'semi_auto',
        port: activePort,
        openContainersForPort: [],
        lastContainer: null,
        existingCountForYear: 2,
        now: new Date('2026-05-18T08:00:00.000Z'),
      }),
    ).toMatchObject({
      action: 'awaiting_approval',
      shouldCreateContainer: true,
      newContainerStatus: 'draft',
      reference: 'CC-2026-003',
    })
  })

  it('full-auto opens the container while preserving the one-open-per-port safeguard', () => {
    expect(
      evaluateAutoOpen({
        mode: 'full_auto',
        port: activePort,
        openContainersForPort: [],
        lastContainer: createContainer({ status: 'shipped' }),
        existingCountForYear: 3,
        now: new Date('2026-05-18T08:00:00.000Z'),
      }),
    ).toMatchObject({
      action: 'open',
      shouldCreateContainer: true,
      newContainerStatus: 'open',
      reference: 'CC-2026-004',
    })

    expect(
      evaluateAutoOpen({
        mode: 'full_auto',
        port: activePort,
        openContainersForPort: [createContainer({ status: 'open' })],
        lastContainer: createContainer({ status: 'production' }),
        existingCountForYear: 3,
      }),
    ).toMatchObject({
      action: 'none',
      shouldCreateContainer: false,
      reason: 'Un container est deja ouvert sur ce port',
    })
  })

  it('does nothing for inactive ports or containers not advanced enough', () => {
    expect(
      evaluateAutoOpen({
        mode: 'semi_auto',
        port: { ...activePort, isActive: false },
        openContainersForPort: [],
        lastContainer: null,
        existingCountForYear: 0,
      }),
    ).toMatchObject({ action: 'none', reason: 'Port inactif' })

    expect(
      evaluateAutoOpen({
        mode: 'semi_auto',
        port: activePort,
        openContainersForPort: [],
        lastContainer: createContainer({ status: 'open' }),
        existingCountForYear: 0,
      }),
    ).toMatchObject({
      action: 'none',
      reason: 'Le dernier container du port nest pas encore assez avance',
    })
  })
})
