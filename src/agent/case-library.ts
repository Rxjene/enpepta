import { z } from "zod";
import banking from "../../data/seed/banking.json";
import telephone from "../../data/seed/telephone.json";
import electricity from "../../data/seed/electricity.json";
import aviation from "../../data/seed/aviation-safety.json";
import { caseSchema, STAGES, type Case, type Driver, type Stage } from "./types";

const seedFileSchema = z.object({
  industry: z.string(),
  jobs: z.array(z.string()).min(4).max(7),
  cases: z.array(caseSchema.omit({ industry: true })),
});
export type SeedIndustry = { industry: string; jobs: string[]; cases: Case[] };

/** Loads and validates the built-in case library. A case with no source fails validation. */
export function loadSeedIndustries(): SeedIndustry[] {
  return [banking, telephone, electricity, aviation].map((raw) => {
    const f = seedFileSchema.parse(raw);
    return { industry: f.industry, jobs: f.jobs, cases: f.cases.map((c) => ({ ...c, industry: f.industry })) };
  });
}

export function loadSeedCases(): Case[] {
  return sortCases(loadSeedIndustries().flatMap((i) => i.cases));
}

/** Chronological order; within one year, follow the pattern order (incident before protective layer before rule). */
export function sortCases(cases: Case[]): Case[] {
  return [...cases].sort((a, b) => a.year - b.year || STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
}

/** Strictly earlier than the cutoff year. Used by the forecaster so it can never see the future. */
export function casesBefore(cases: Case[], cutoffYear: number): Case[] {
  return cases.filter((c) => c.year < cutoffYear);
}

export type CaseFilter = { industry?: string; driver?: Driver; stage?: Stage; q?: string };

export function filterCases(cases: Case[], f: CaseFilter): Case[] {
  const q = f.q?.trim().toLowerCase();
  return cases.filter(
    (c) =>
      (!f.industry || c.industry === f.industry) &&
      (!f.driver || c.main_driver === f.driver || c.supporting_drivers.includes(f.driver)) &&
      (!f.stage || c.stage === f.stage) &&
      (!q || `${c.what_created} ${c.job} ${c.source} ${c.industry}`.toLowerCase().includes(q)),
  );
}

export type Transition = { from: Case; to: Case; lagYears: number };

/** Consecutive cases within one industry. Same-year pairs get a lag of 0. */
export function transitions(cases: Case[]): Transition[] {
  const byIndustry = new Map<string, Case[]>();
  for (const c of sortCases(cases)) byIndustry.set(c.industry, [...(byIndustry.get(c.industry) ?? []), c]);
  const out: Transition[] = [];
  for (const list of byIndustry.values())
    for (let i = 0; i + 1 < list.length; i++) out.push({ from: list[i], to: list[i + 1], lagYears: list[i + 1].year - list[i].year });
  return out;
}

/** Reads cases from Supabase (the seeded table). Falls back to the built-in seed when no client is given. */
export async function fetchCases(
  client?: { from: (t: string) => { select: (c: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } } | null,
): Promise<Case[]> {
  if (!client) return loadSeedCases();
  const { data, error } = await client.from("cases").select("*");
  if (error) throw new Error(`Could not read cases: ${error.message}`);
  return sortCases(z.array(caseSchema.passthrough()).parse(data ?? []) as Case[]);
}
