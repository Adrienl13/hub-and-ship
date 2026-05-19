import { describe, expect, it } from "vitest";
import { computePastContainersStats, type Container } from "./catalog";

function mkContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: "c1",
    reference: "CC-2025-001",
    port: "Marseille-Fos",
    capacityCbm: 28,
    thresholdPercent: 80,
    minSeriesRequired: 3,
    expectedCloseAt: null,
    status: "delivered",
    deliveredAt: "2025-12-12",
    plannedDays: 75,
    actualDays: 78,
    photoUrl: null,
    testimonial: null,
    totalSeries: 5,
    seriesReached: 3,
    professionalsEngaged: 8,
    totalItems: 287,
    ...overrides,
  };
}

describe("computePastContainersStats", () => {
  it("returns zeroed stats for empty list", () => {
    const s = computePastContainersStats([]);
    expect(s).toEqual({
      totalContainers: 0,
      totalProsServed: 0,
      totalItems: 0,
      onTimeRate: 0,
    });
  });

  it("sums pros and items across containers", () => {
    const s = computePastContainersStats([
      mkContainer({ professionalsEngaged: 8, totalItems: 287 }),
      mkContainer({ professionalsEngaged: 6, totalItems: 198 }),
      mkContainer({ professionalsEngaged: 11, totalItems: 412 }),
    ]);
    expect(s.totalContainers).toBe(3);
    expect(s.totalProsServed).toBe(25);
    expect(s.totalItems).toBe(897);
  });

  it("computes on-time rate based on planned vs actual days", () => {
    // 2/3 on time
    const s = computePastContainersStats([
      mkContainer({ plannedDays: 75, actualDays: 78 }), // late
      mkContainer({ plannedDays: 75, actualDays: 71 }), // on time
      mkContainer({ plannedDays: 75, actualDays: 75 }), // on time
    ]);
    expect(s.onTimeRate).toBeCloseTo(2 / 3);
  });

  it("ignores containers with missing planned/actual days for on-time rate", () => {
    const s = computePastContainersStats([
      mkContainer({ plannedDays: 75, actualDays: 70 }), // on time, counts
      mkContainer({ plannedDays: null, actualDays: 80 }), // ignored
      mkContainer({ plannedDays: 75, actualDays: null }), // ignored
    ]);
    expect(s.onTimeRate).toBe(1);
  });

  it("returns 0 on-time rate when no measurable containers", () => {
    const s = computePastContainersStats([
      mkContainer({ plannedDays: null, actualDays: null }),
      mkContainer({ plannedDays: null, actualDays: null }),
    ]);
    expect(s.onTimeRate).toBe(0);
  });

  it("considers exact match (actual === planned) as on-time", () => {
    const s = computePastContainersStats([mkContainer({ plannedDays: 75, actualDays: 75 })]);
    expect(s.onTimeRate).toBe(1);
  });
});
