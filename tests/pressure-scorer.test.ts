import { describe, expect, it } from "vitest";
import { cellScore, scorePressure, signalWeight, SCORING } from "@/agent/pressure-scorer";
import type { Signal } from "@/agent/types";

const asOf = new Date("2026-01-01T00:00:00Z");
const base: Signal = {
  industry: "banking", job: "lending", driver: "trust", description: "x", strength: 3,
  source_url: "https://example.org/a", observed_on: "2026-01-01",
};

describe("pressure-scorer", () => {
  it("gives the same output for the same input", () => {
    const sigs = [base, { ...base, driver: "growth" as const, strength: 5 }, { ...base, observed_on: "2025-01-01" }];
    const a = scorePressure(sigs, ["lending", "safekeeping"], asOf);
    const b = scorePressure([...sigs].reverse(), ["lending", "safekeeping"], asOf);
    expect(a).toEqual(b);
    expect(JSON.stringify(scorePressure(sigs, ["lending", "safekeeping"], asOf))).toBe(JSON.stringify(a));
  });

  it("gives unsourced signals exactly half the weight of sourced ones", () => {
    const sourced = signalWeight(base, asOf);
    expect(signalWeight({ ...base, source_url: null }, asOf)).toBe(sourced * SCORING.UNSOURCED_WEIGHT);
    expect(signalWeight({ ...base, source_url: "  " }, asOf)).toBe(sourced / 2);
    expect(sourced).toBe(3);
  });

  it("keeps scores between 0 and 10 and rises with evidence", () => {
    expect(cellScore(0)).toBe(0);
    expect(cellScore(1e9)).toBeLessThanOrEqual(10);
    expect(cellScore(5)).toBeGreaterThan(cellScore(2));
  });

  it("halves a signal's weight every half-life and ignores future-dated signals", () => {
    const old = { ...base, observed_on: "2024-01-01" };
    expect(signalWeight(old, asOf)).toBeCloseTo(signalWeight(base, asOf) / 2, 1);
    const m = scorePressure([{ ...base, observed_on: "2027-01-01" }], ["lending"], asOf);
    expect(m.lending.trust).toBe(0);
  });

  it("ignores signals for jobs not in the list and puts scores on the right cell", () => {
    const m = scorePressure([base, { ...base, job: "nope" }], ["lending"], asOf);
    expect(m.lending.trust).toBeGreaterThan(0);
    expect(m.lending.growth).toBe(0);
    expect(Object.keys(m)).toEqual(["lending"]);
  });
});
