import { describe, expect, it } from "vitest";
import { brierScore, calibrationTable, runBacktest } from "@/agent/backtest";
import { loadSeedCases, loadSeedIndustries } from "@/agent/case-library";
import { challenge, RARE_SHOCK_NOTE } from "@/agent/challenger";
import { validateJobs } from "@/agent/industry-mapper";
import { extractSignals } from "@/agent/signal-collector";
import { writeReasons } from "@/agent/forecaster";
import type { LlmClient } from "@/agent/llm";

const banking = loadSeedIndustries().find((i) => i.industry === "banking")!;

describe("banking backtest, cutoff 1925", () => {
  it("runs end to end and reports hit, Brier score and calibration", async () => {
    const r = await runBacktest("banking", banking.jobs, loadSeedCases(), 1925);
    expect(r.cutoffYear).toBe(1925);
    expect(r.actual).toBe("incident");
    expect(r.actualYear).toBe(1929);
    expect(r.predicted).toBe("incident");
    expect(r.hit).toBe(true);
    expect(r.brier).toBeGreaterThanOrEqual(0);
    expect(r.brier).toBeLessThan(r.baselineBrier);
    expect(r.calibration).toHaveLength(5);
    expect(r.calibration.reduce((s, b) => s + b.count, 0)).toBeGreaterThan(0);
    expect(r.forecast.excludedFutureCases).toBeGreaterThan(0);
    expect(r.challenger.rareShocks).toContain(RARE_SHOCK_NOTE);
  });
  it("fails clearly when there is nothing earlier or later", async () => {
    await expect(runBacktest("banking", banking.jobs, loadSeedCases(), -3000)).rejects.toThrow(/before/);
    await expect(runBacktest("banking", banking.jobs, loadSeedCases(), 2100)).rejects.toThrow(/onward/);
  });
});

describe("scoring helpers", () => {
  it("computes Brier correctly", () => {
    const d = { expansion: 0, incident: 1, protective_layer: 0, rule: 0 };
    expect(brierScore(d, "incident")).toBe(0);
    expect(brierScore(d, "rule")).toBe(2);
    expect(brierScore({ expansion: 0.25, incident: 0.25, protective_layer: 0.25, rule: 0.25 }, "rule")).toBe(0.75);
  });
  it("bins calibration", () => {
    const t = calibrationTable([{ distribution: { expansion: 0.1, incident: 0.7, protective_layer: 0.1, rule: 0.1 }, actual: "incident" }]);
    expect(t[3]).toMatchObject({ count: 1, observed: 1 });
  });
});

const fake = (impl: (r: { toolName: string }) => unknown): LlmClient => ({
  json: async (r) => r.schema.parse(impl(r)),
  ping: async () => {},
});

describe("language-model steps", () => {
  it("marks signals without a source URL as unsourced and drops URLs the search never returned", async () => {
    const llm = fake(() => ({ signals: [
      { job: "lending", driver: "trust", description: "Customers switching to alternatives", strength: 3, source_url: null, published_on: null },
      { job: "lending", driver: "growth", description: "Backlog of loan applications", strength: 4, source_url: "https://made-up.example/x", published_on: "2025-05-01" },
      { job: "lending", driver: "growth", description: "Backlog at agency", strength: 2, source_url: "https://real.example/y", published_on: "2025-05-01" },
      { job: "not a job", driver: "growth", description: "ignored", strength: 2, source_url: null, published_on: null },
    ] }));
    const out = await extractSignals(llm, { industry: "banking", jobs: banking.jobs, text: "t", origin: "web", today: new Date("2026-01-01"), allowedUrls: ["https://real.example/y"] });
    expect(out).toHaveLength(3);
    expect(out.filter((s) => s.unsourced).length).toBe(2);
    expect(out.find((s) => s.source_url)?.source_url).toBe("https://real.example/y");
  });
  it("keeps the rare-shock note even if the model is silent, and falls back to plain facts if numbers change", async () => {
    const r = await runBacktest("banking", banking.jobs, loadSeedCases(), 1925);
    const notes = await challenge({ forecast: r.forecast, scores: {}, signals: [], industriesCovered: 4 }, null);
    expect(notes.rareShocks[0]).toMatch(/pandemic/);
    const liar = fake(() => ({ reasons: ["The odds are 99% and certain.", "Another reason with 12345 inside.", "A third reason text here."] }));
    expect(await writeReasons(liar, r.forecast)).toEqual(r.forecast.facts);
  });
  it("validates job lists", () => {
    expect(validateJobs([{ name: "a b" }])).toHaveLength(1);
    expect(validateJobs(banking.jobs.map((name) => ({ name })))).toEqual([]);
    expect(validateJobs([...banking.jobs, "lending"].map((name) => ({ name })))).toContain("Job names must be different from each other.");
  });
});
