import { describe, expect, it } from "vitest";
import { casesBefore, filterCases, loadSeedCases, loadSeedIndustries, transitions } from "@/agent/case-library";
import { caseSchema } from "@/agent/types";

describe("case library seed", () => {
  const cases = loadSeedCases();
  it("covers banking plus telephone, electricity and aviation", () => {
    expect(new Set(cases.map((c) => c.industry))).toEqual(new Set(["banking", "telephone service", "electricity", "aviation safety"]));
    expect(cases.filter((c) => c.industry === "banking").length).toBeGreaterThanOrEqual(10);
  });
  it("cites a source for every case and uses a job from its industry", () => {
    for (const ind of loadSeedIndustries())
      for (const c of ind.cases) {
        expect(c.source.trim().length).toBeGreaterThan(10);
        expect(ind.jobs).toContain(c.job);
      }
  });
  it("rejects a case with no source", () => {
    expect(() => caseSchema.parse({ ...cases[0], source: "" })).toThrow();
  });
  it("filters by cutoff, industry, driver, stage and text", () => {
    expect(casesBefore(cases, 1925).every((c) => c.year < 1925)).toBe(true);
    expect(filterCases(cases, { industry: "banking", stage: "rule" }).every((c) => c.stage === "rule")).toBe(true);
    expect(filterCases(cases, { q: "bitcoin" }).length).toBe(1);
  });
  it("reproduces the shrinking crisis-to-rule gaps for banking", () => {
    const t = transitions(cases.filter((c) => c.industry === "banking"));
    const lag = (a: number, b: number) =>
      cases.find((c) => c.industry === "banking" && c.year === b && c.stage === "rule")!.year -
      cases.find((c) => c.industry === "banking" && c.year === a && c.stage === "incident")!.year;
    expect([lag(1907, 1913), lag(1929, 1933), lag(2008, 2010)]).toEqual([6, 4, 2]);
    expect(t.length).toBeGreaterThan(5);
  });
});
