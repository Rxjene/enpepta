import { DRIVERS, type Driver, type ScoreMatrix, type Signal } from "./types";

/** Constants for the arithmetic. Documented in docs/rubric.md; changing them changes model_version behaviour. */
export const SCORING = {
  /** Weight multiplier for a signal that has no source URL. */
  UNSOURCED_WEIGHT: 0.5,
  SOURCED_WEIGHT: 1,
  /** Signals lose half their weight every this many years. */
  HALF_LIFE_YEARS: 2,
  /** Weighted points at which a cell reaches about 6.3 out of 10 (1 - 1/e). Bigger = harder to score high. */
  SATURATION: 8,
  MAX_SCORE: 10,
} as const;

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

export function isUnsourced(s: Pick<Signal, "source_url">): boolean {
  return !s.source_url || s.source_url.trim() === "";
}

/** Weight of one signal as of a date. Pure: depends only on its arguments. */
export function signalWeight(s: Signal, asOf: Date): number {
  const observed = Date.parse(s.observed_on + "T00:00:00Z");
  if (Number.isNaN(observed)) return 0;
  const ageYears = Math.max(0, (asOf.getTime() - observed) / MS_PER_YEAR);
  const recency = Math.pow(0.5, ageYears / SCORING.HALF_LIFE_YEARS);
  const source = isUnsourced(s) ? SCORING.UNSOURCED_WEIGHT : SCORING.SOURCED_WEIGHT;
  return s.strength * source * recency;
}

/** Cell score: 10 * (1 - exp(-points / SATURATION)), rounded to 2 decimals. */
export function cellScore(points: number): number {
  return Math.round(SCORING.MAX_SCORE * (1 - Math.exp(-points / SCORING.SATURATION)) * 100) / 100;
}

export function emptyRow(): Record<Driver, number> {
  return Object.fromEntries(DRIVERS.map((d) => [d, 0])) as Record<Driver, number>;
}

/**
 * Turns signals into a 0 to 10 score for each job and driver pair.
 * Signals dated after `asOf` are ignored. No language model is involved.
 */
export function scorePressure(signals: Signal[], jobs: string[], asOf: Date): ScoreMatrix {
  const points: Record<string, Record<Driver, number>> = {};
  for (const j of jobs) points[j] = emptyRow();
  for (const s of signals) {
    if (!points[s.job]) continue; // signal for a job that is not in this industry's list
    if (Date.parse(s.observed_on + "T00:00:00Z") > asOf.getTime()) continue;
    points[s.job][s.driver] += signalWeight(s, asOf);
  }
  const out: ScoreMatrix = {};
  for (const j of jobs) {
    out[j] = emptyRow();
    for (const d of DRIVERS) out[j][d] = cellScore(points[j][d]);
  }
  return out;
}

/** One 0 to 10 number per driver across all jobs (the strongest job for that driver). */
export function driverSummary(scores: ScoreMatrix): Record<Driver, number> {
  const out = emptyRow();
  for (const row of Object.values(scores)) for (const d of DRIVERS) out[d] = Math.max(out[d], row[d]);
  return out;
}

export function sourcedShare(signals: Signal[]): number {
  if (signals.length === 0) return 0;
  return signals.filter((s) => !isUnsourced(s)).length / signals.length;
}
