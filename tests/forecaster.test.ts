import { describe, expect, it } from "vitest";
import { forecast } from "@/agent/forecaster";
import { loadSeedCases } from "@/agent/case-library";
import { pressureFromCases } from "@/agent/backtest";
import type { Case } from "@/agent/types";

const cases = loadSeedCases();
const jobs = ["safekeeping", "lending", "moving value", "record keeping", "rules and oversight", "trust"];
const run = (list: Case[], cutoffYear: number) =>
  forecast({ industry: "banking", scores: pressureFromCases(list.filter((c) => c.industry === "banking"), jobs, cutoffYear), cases: list, cutoffYear, stage: "expansion", stageBasis: "test" });

describe("forecaster cutoff", () => {
  it("refuses to use cases dated at or after the cutoff", () => {
    const future: Case[] = [1925, 1926, 1929, 2008].flatMap((year) =>
      (["incident", "rule", "protective_layer"] as const).map((stage) => ({
        industry: "banking", year, job: "lending", main_driver: "stability" as const, supporting_drivers: [], stage,
        what_created: "FUTURE LEAK", source: "test", approximate: false,
      })),
    );
    const clean = run(cases.filter((c) => c.year < 1925), 1925);
    const polluted = run([...cases, ...future], 1925);
    expect(polluted.excludedFutureCases).toBe(cases.filter((c) => c.year >= 1925).length + future.length);
    // Same probabilities, window and evidence as if the future cases did not exist.
    expect({ ...polluted, excludedFutureCases: 0 }).toEqual(clean);
    expect(JSON.stringify(polluted.influences)).not.toContain("FUTURE LEAK");
  });

  it("is deterministic", () => {
    expect(run(cases, 1925)).toEqual(run(cases, 1925));
  });

  it("labels fewer than 5 comparable cases as low evidence and widens the window", () => {
    const few = run(cases, 1900);
    expect(few.casesUsed).toBeLessThan(5);
    expect(few.lowEvidence).toBe(true);
    const many = run(cases, 2020);
    expect(many.lowEvidence).toBe(false);
  });

  it("returns probabilities that add up to 1", () => {
    const f = run(cases, 1925);
    expect(Object.values(f.distribution).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(f.probability).toBe(f.distribution[f.nextLayer]);
  });
});
