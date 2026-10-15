import type { LlmClient } from "./llm";
import type { ForecastResult } from "./forecaster";
import { confidenceSchema, feasibilitySchema, STAGE_LABELS, type Case, type Feasibility } from "./types";

const NOT_ASSESSED = { answer: "Not assessed: the language model is not configured or did not respond.", confidence: "low" as const };

/** Three plain-language questions that sit beside every forecast. */
export async function feasibility(llm: LlmClient | null, f: ForecastResult, relatedCases: Case[]): Promise<Feasibility> {
  if (!llm) return { responsible: NOT_ASSESSED, regulator: NOT_ASSESSED, trust: NOT_ASSESSED };
  try {
    return await llm.json({
      system: `You answer three questions about a public-facing industry, in plain English, 2 to 3 sentences each, using only the facts given and well-known public knowledge.
Say clearly when you are unsure. Confidence is low, medium or high and must reflect how much the facts support the answer. Never invent names, dates or statistics.`,
      user: JSON.stringify({
        industry: f.industry,
        stage: STAGE_LABELS[f.stage],
        likelyNext: STAGE_LABELS[f.nextLayer],
        pastCases: relatedCases.slice(-12).map((c) => ({ year: c.year, stage: c.stage, what: c.what_created })),
        questions: {
          responsible: "Who will be responsible when this fails?",
          regulator: "Which regulator or government body will most likely end up with it?",
          trust: "What will make everyday users trust it?",
        },
      }),
      schema: feasibilitySchema,
      toolName: "return_feasibility",
    });
  } catch {
    return { responsible: NOT_ASSESSED, regulator: NOT_ASSESSED, trust: NOT_ASSESSED };
  }
}
export { confidenceSchema };
