import { z } from "zod";
import { isUnsourced } from "./pressure-scorer";
import { driverSchema, signalSchema, type Signal } from "./types";
import type { LlmClient } from "./llm";

const extractedSchema = z.object({
  signals: z
    .array(
      z.object({
        job: z.string(),
        driver: driverSchema,
        description: z.string().min(5).max(400),
        strength: z.number().int().min(1).max(5),
        source_url: z.string().nullable(),
        published_on: z.string().nullable(),
      }),
    )
    .max(25),
});

const RUBRIC_HINT = `Drivers: growth = demand versus capacity (wait times, backlogs); security = fraud and loss incidents;
government = new budgets, mandates, deadlines; stability = outages, near-failures, bailouts;
technology = cost or speed gap between old and new method; trust = surveys, switching to alternatives, complaint volume.
Strength: 1 = a hint, 2 = a minor report, 3 = a clear reported problem, 4 = a serious or widespread one, 5 = severe and well documented.`;

const SYSTEM = `You extract evidence about current pressure on an industry. You only extract and classify. You never invent facts.
${RUBRIC_HINT}
Rules: use only what the text says. "job" must be exactly one of the listed jobs. If the text gives no source URL for a claim, set source_url to null.
published_on is YYYY-MM-DD only if the text states it; otherwise null. Skip anything that is not evidence of pressure. Never include personal or health data.`;

export type CollectInput = {
  industry: string;
  jobs: string[];
  text: string;
  /** Where the text came from, if known. Leave empty for an upload with no known URL: signals will be unsourced. */
  sourceUrl?: string | null;
  origin: "web" | "upload";
  today: Date;
  /** For web results: signals may only cite URLs in this set. */
  allowedUrls?: string[];
};

/** Language model extracts and classifies signals from text. All arithmetic happens later, in pressure-scorer. */
export async function extractSignals(llm: LlmClient, input: CollectInput): Promise<Signal[]> {
  const out = await llm.json({
    system: SYSTEM,
    user: `Industry: ${input.industry}\nJobs: ${input.jobs.join("; ")}\n\nText:\n"""\n${input.text.slice(0, 40000)}\n"""`,
    schema: extractedSchema,
    toolName: "return_signals",
    maxTokens: 4000,
  });
  const todayIso = input.today.toISOString().slice(0, 10);
  const seen = new Set<string>();
  const signals: Signal[] = [];
  for (const s of out.signals) {
    if (!input.jobs.includes(s.job)) continue;
    let url: string | null = s.source_url ?? input.sourceUrl ?? null;
    if (url && input.allowedUrls && !input.allowedUrls.includes(url)) url = null; // a URL the search never returned is not a source
    if (url && !z.string().url().safeParse(url).success) url = null;
    const observed = s.published_on && /^\d{4}-\d{2}-\d{2}$/.test(s.published_on) && s.published_on <= todayIso ? s.published_on : todayIso;
    const candidate = {
      industry: input.industry, job: s.job, driver: s.driver, description: s.description.trim(),
      strength: s.strength, source_url: url, observed_on: observed,
    };
    const key = `${candidate.job}|${candidate.driver}|${candidate.description.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsed = signalSchema.safeParse({ ...candidate, unsourced: isUnsourced(candidate) });
    if (parsed.success) signals.push(parsed.data);
  }
  return signals;
}

/** Uploaded document text (plain text or markdown). No URL unless the user gives one. */
export function collectFromDocument(llm: LlmClient, input: Omit<CollectInput, "origin">) {
  return extractSignals(llm, { ...input, origin: "upload" });
}

/** Web search, only when the client supports it (ENABLE_WEB_SEARCH=true). Returns [] otherwise. */
export async function collectFromWeb(llm: LlmClient, industry: string, jobs: string[], today: Date): Promise<Signal[]> {
  if (!llm.search) return [];
  const found = await llm.search(
    `Find recent, specific, public evidence of pressure on the "${industry}" industry (wait times, backlogs, fraud or loss incidents, new mandates or budgets, outages, new technology, complaint volume or customers switching). Summarise each finding with its source and date. Only report what the sources say.`,
  );
  if (!found.text.trim()) return [];
  return extractSignals(llm, { industry, jobs, text: found.text, origin: "web", today, allowedUrls: found.urls });
}
