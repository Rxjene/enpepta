import { z } from "zod";
import { loadSeedIndustries } from "./case-library";
import type { LlmClient } from "./llm";

export const jobSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().min(5).max(240),
});
export const mappedIndustrySchema = z.object({
  industry: z.string().min(1),
  jobs: z.array(jobSchema).min(4).max(7),
});
export type MappedIndustry = z.infer<typeof mappedIndustrySchema>;

const SYSTEM = `You map a public-facing industry to its constant jobs: the things it must always do, whatever tools it uses.
Return 4 to 7 jobs. Each job is a short plain-English name (2 to 5 words) plus one sentence saying what it means.
Use only well-known public knowledge about the industry. Do not mention any individual person or any health record.`;

/** Asks the language model for 4 to 7 constant jobs. A person can edit the result before it is saved. */
export async function mapIndustry(name: string, llm: LlmClient | null): Promise<MappedIndustry> {
  const clean = name.trim();
  if (!clean) throw new Error("Please enter an industry name.");
  if (!llm) {
    const seed = loadSeedIndustries().find((s) => s.industry.toLowerCase() === clean.toLowerCase());
    if (seed) return { industry: seed.industry, jobs: seed.jobs.map((j) => ({ name: j, description: "From the built-in case library." })) };
    throw new Error("The language model is not configured (ANTHROPIC_API_KEY is missing), so new industries cannot be mapped yet.");
  }
  const out = await llm.json({
    system: SYSTEM,
    user: `Industry: ${clean}`,
    schema: mappedIndustrySchema,
    toolName: "return_jobs",
  });
  return { industry: clean, jobs: out.jobs };
}

/** Validates a human-edited job list before saving. Returns a list of problems (empty = fine). */
export function validateJobs(jobs: { name: string }[]): string[] {
  const problems: string[] = [];
  if (jobs.length < 4 || jobs.length > 7) problems.push("An industry needs between 4 and 7 jobs.");
  const names = jobs.map((j) => j.name.trim().toLowerCase());
  if (names.some((n) => n.length < 2)) problems.push("Every job needs a name.");
  if (new Set(names).size !== names.length) problems.push("Job names must be different from each other.");
  return problems;
}
