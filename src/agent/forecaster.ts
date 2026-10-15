import { casesBefore, transitions, type Transition } from "./case-library";
import { driverSummary } from "./pressure-scorer";
import { z } from "zod";
import type { LlmClient } from "./llm";
import {
  DRIVERS, MODEL_VERSION, NEXT_STAGE, STAGES, STAGE_LABELS,
  type Case, type Driver, type ScoreMatrix, type Stage,
} from "./types";

/** Tunable constants. Probabilities and windows come from these and the case data only. */
export const FORECAST = {
  /** Weight of the built-in "expansion, incident, protective layer, rule" pattern when evidence is thin (like n pseudo-cases). */
  PRIOR_STRENGTH: 1.5,
  PRIOR_ON_PATTERN: 0.6,
  SAME_INDUSTRY_BOOST: 1.5,
  RECENCY_HALF_LIFE_YEARS: 100,
  /** Timing only: gaps between stages shrink over time, so old gaps count less (measured at the middle of each gap). */
  TIMING_HALF_LIFE_YEARS: 40,
  MIN_TIMING_SAMPLES: 3,
  LOW_EVIDENCE_BELOW: 5,
  LOW_EVIDENCE_PRIOR_MULTIPLIER: 2,
  DEFAULT_WINDOW_YEARS: [1, 10] as [number, number],
} as const;

export type ForecastInput = {
  industry: string;
  /** Pressure scores by job and driver (0 to 10). */
  scores: ScoreMatrix;
  /** Any cases. The forecaster itself drops every case dated at or after cutoffYear. */
  cases: Case[];
  /** Only cases with year < cutoffYear are used. For a live forecast pass (this year + 1). */
  cutoffYear: number;
  stage: Stage;
  /** Where the stage came from, shown to the reader. */
  stageBasis: string;
  /** Year the current stage began, if known. Defaults to cutoffYear. */
  stageSinceYear?: number;
};

export type Influence = { industry: string; year: number; stage: Stage; what: string; share: number };

export type ForecastResult = {
  industry: string;
  cutoffYear: number;
  stage: Stage;
  stageBasis: string;
  nextLayer: Stage;
  probability: number;
  distribution: Record<Stage, number>;
  window: { startYear: number; endYear: number; medianYear: number };
  casesUsed: number;
  lowEvidence: boolean;
  /** Fewer than 3 past gaps back the time window, so it is widened. */
  timingThin: boolean;
  excludedFutureCases: number;
  influences: Influence[];
  /** Plain facts behind the top three reasons. The language model may reword them but not change numbers. */
  facts: string[];
  drivers: Record<Driver, number>;
  modelVersion: string;
};

function round(x: number, d = 3) {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

function caseVector(c: Case): number[] {
  return DRIVERS.map((d) => (c.main_driver === d ? 1 : c.supporting_drivers.includes(d) ? 0.5 : 0));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Weighted quantile of (value, weight) pairs. */
export function weightedQuantile(items: { v: number; w: number }[], q: number): number {
  const s = [...items].sort((a, b) => a.v - b.v);
  const total = s.reduce((t, x) => t + x.w, 0);
  if (s.length === 0 || total <= 0) return NaN;
  let acc = 0;
  for (const x of s) {
    acc += x.w;
    if (acc / total >= q) return x.v;
  }
  return s[s.length - 1].v;
}

/** Rough stage from live pressure. Documented in docs/rubric.md; a person can override it. */
export function inferStageFromPressure(scores: ScoreMatrix): { stage: Stage; basis: string } {
  const d = driverSummary(scores);
  const harm = Math.max(d.stability, d.security);
  if (harm >= 6) {
    return d.government >= 6
      ? { stage: "protective_layer", basis: "Stability or security pressure is high and government pressure is also high, so a protective response looks under way." }
      : { stage: "incident", basis: "Stability or security pressure is high (6 or more) and government pressure is not yet high." };
  }
  if (d.government >= 6 && harm >= 3) return { stage: "rule", basis: "Government pressure is high after earlier harm signals, so rules look to be arriving." };
  return { stage: "expansion", basis: "No strong incident signals, so the industry is treated as in a growth phase." };
}

export function forecast(input: ForecastInput): ForecastResult {
  const usable = casesBefore(input.cases, input.cutoffYear); // the only place cases enter the forecast
  const excludedFutureCases = input.cases.length - usable.length;
  const drivers = driverSummary(input.scores);
  const current = DRIVERS.map((d) => drivers[d] / 10);
  const anchor = input.stageSinceYear ?? input.cutoffYear;

  const comparable = transitions(usable).filter((t) => t.from.stage === input.stage);
  const weighted = comparable.map((t) => {
    const sim = (0.25 + 0.75 * cosine(current, caseVector(t.from))) * (t.from.industry === input.industry ? FORECAST.SAME_INDUSTRY_BOOST : 1);
    const mid = (t.from.year + t.to.year) / 2;
    return {
      t,
      w: sim * Math.pow(0.5, Math.max(0, input.cutoffYear - t.to.year) / FORECAST.RECENCY_HALF_LIFE_YEARS),
      wTime: sim * Math.pow(0.5, Math.max(0, input.cutoffYear - mid) / FORECAST.TIMING_HALF_LIFE_YEARS),
    };
  });
  const totalW = weighted.reduce((s, x) => s + x.w, 0);
  const n = comparable.length;
  const lowEvidence = n < FORECAST.LOW_EVIDENCE_BELOW;

  const alpha = FORECAST.PRIOR_STRENGTH * (lowEvidence ? FORECAST.LOW_EVIDENCE_PRIOR_MULTIPLIER : 1);
  const pattern = NEXT_STAGE[input.stage];
  const rest = (1 - FORECAST.PRIOR_ON_PATTERN) / (STAGES.length - 1);
  const distribution = {} as Record<Stage, number>;
  for (const k of STAGES) {
    const observed = weighted.filter((x) => x.t.to.stage === k).reduce((s, x) => s + x.w, 0);
    const prior = k === pattern ? FORECAST.PRIOR_ON_PATTERN : rest;
    distribution[k] = round((observed + alpha * prior) / (totalW + alpha), 4);
  }
  // Highest probability wins; ties go to the pattern's next stage.
  const nextLayer = [...STAGES].sort((a, b) => distribution[b] - distribution[a] || (a === pattern ? -1 : b === pattern ? 1 : 0))[0];
  const probability = distribution[nextLayer];

  // Timing: weighted lags of comparable transitions that ended in the predicted stage.
  const toNext = weighted.filter((x) => x.t.to.stage === nextLayer);
  const timingSamples = toNext.length;
  // With fewer than 3 precedents for this exact step, use the gaps from every step that left this stage.
  const lagItems = (toNext.length >= FORECAST.MIN_TIMING_SAMPLES ? toNext : weighted).map((x) => ({ v: x.t.lagYears, w: x.wTime }));
  const timingThin = timingSamples < FORECAST.MIN_TIMING_SAMPLES;
  let lo: number, mid: number, hi: number;
  if (lagItems.length === 0) {
    [lo, hi] = FORECAST.DEFAULT_WINDOW_YEARS;
    mid = (lo + hi) / 2;
  } else {
    lo = weightedQuantile(lagItems, 0.25);
    mid = weightedQuantile(lagItems, 0.5);
    hi = weightedQuantile(lagItems, 0.75);
  }
  if (lowEvidence || timingThin) { lo = lo * 0.5; hi = hi * 1.5 + 1; }
  let startYear = anchor + lo;
  let endYear = Math.max(anchor + hi, startYear + 1);
  let medianYear = anchor + mid;
  if (startYear < input.cutoffYear) {
    // The earliest historical lag has already passed without the event; the window starts at the cutoff.
    const span = endYear - startYear;
    startYear = input.cutoffYear;
    endYear = Math.max(endYear, startYear + Math.max(1, span));
    medianYear = Math.max(medianYear, startYear);
  }

  const influences: Influence[] = [...weighted]
    .sort((a, b) => b.w - a.w)
    .slice(0, 5)
    .map((x) => ({ industry: x.t.from.industry, year: x.t.from.year, stage: x.t.to.stage, what: x.t.from.what_created, share: round(totalW ? x.w / totalW : 0) }));

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const wentNext = comparable.filter((t: Transition) => t.to.stage === nextLayer).length;
  const topDrivers = [...DRIVERS].sort((a, b) => drivers[b] - drivers[a]).filter((d) => drivers[d] > 0).slice(0, 2);
  const facts = [
    n === 0
      ? `No past cases at the "${STAGE_LABELS[input.stage]}" stage were found before ${input.cutoffYear}, so the odds lean on the general pattern only.`
      : `${n} past case${n === 1 ? "" : "s"} at the "${STAGE_LABELS[input.stage]}" stage were found; ${wentNext} of them were followed by "${STAGE_LABELS[nextLayer]}". Blended with the general pattern, that gives ${pct(probability)}.`,
    topDrivers.length
      ? `Strongest current pressure: ${topDrivers.map((d) => `${d} (${drivers[d]}/10)`).join(" and ")}.`
      : `No pressure signals are recorded, so similarity to past cases could not be used.`,
    lagItems.length
      ? `In comparable cases, the gap before "${STAGE_LABELS[nextLayer]}" was typically ${round(lo, 1)} to ${round(hi, 1)} years (middle ${round(mid, 1)}).`
      : `No past gaps were available, so a default window of ${FORECAST.DEFAULT_WINDOW_YEARS.join(" to ")} years is used.`,
  ];

  return {
    industry: input.industry, cutoffYear: input.cutoffYear, stage: input.stage, stageBasis: input.stageBasis,
    nextLayer, probability, distribution,
    window: { startYear: round(startYear, 1), endYear: round(endYear, 1), medianYear: round(medianYear, 1) },
    casesUsed: n, lowEvidence, timingThin, excludedFutureCases, influences, facts, drivers, modelVersion: MODEL_VERSION,
  };
}

const reasonsSchema = z.object({ reasons: z.array(z.string().min(10).max(300)).length(3) });

/** The language model only rewrites the facts in plain English. Numbers must survive unchanged; otherwise the plain facts are used. */
export async function writeReasons(llm: LlmClient | null, f: ForecastResult): Promise<string[]> {
  if (!llm) return f.facts;
  try {
    const out = await llm.json({
      system: "Rewrite three facts as three short plain-English reasons for a non-expert. Keep every number exactly as given. Do not add facts, names or numbers. Do not say anything is certain.",
      user: JSON.stringify(f.facts),
      schema: reasonsSchema,
      toolName: "return_reasons",
    });
    const nums = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).sort().join(",");
    return nums(out.reasons.join(" ")) === nums(f.facts.join(" ")) ? out.reasons : f.facts;
  } catch {
    return f.facts;
  }
}
