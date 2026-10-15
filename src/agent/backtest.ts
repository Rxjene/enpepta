import { casesBefore, sortCases } from "./case-library";
import { challenge, type ChallengerNotes } from "./challenger";
import { forecast, type ForecastResult } from "./forecaster";
import { cellScore, emptyRow } from "./pressure-scorer";
import { DRIVERS, STAGES, type Case, type ScoreMatrix, type Stage } from "./types";

/** Past pressure is rebuilt from the case record: each case adds points to its job and drivers, fading over time. */
export const HISTORY = { MAIN_POINTS: 8, SUPPORTING_POINTS: 4, HALF_LIFE_YEARS: 15 } as const;

export function pressureFromCases(ownCases: Case[], jobs: string[], cutoffYear: number): ScoreMatrix {
  const points: Record<string, Record<string, number>> = {};
  for (const j of jobs) points[j] = Object.fromEntries(DRIVERS.map((d) => [d, 0]));
  for (const c of casesBefore(ownCases, cutoffYear)) {
    if (!points[c.job]) continue;
    const fade = Math.pow(0.5, (cutoffYear - c.year) / HISTORY.HALF_LIFE_YEARS);
    points[c.job][c.main_driver] += HISTORY.MAIN_POINTS * fade;
    for (const d of c.supporting_drivers) points[c.job][d] += HISTORY.SUPPORTING_POINTS * fade;
  }
  const out: ScoreMatrix = {};
  for (const j of jobs) {
    out[j] = emptyRow();
    for (const d of DRIVERS) out[j][d] = cellScore(points[j][d]);
  }
  return out;
}

export type BacktestRun = {
  industry: string;
  cutoffYear: number;
  stage: Stage;
  predicted: Stage;
  actual: Stage;
  actualYear: number;
  actualWhat: string;
  hit: boolean;
  /** Did the real event land inside the forecast time window? */
  inWindow: boolean;
  /** Multi-class Brier score for this one forecast: 0 is perfect, 2 is worst. */
  brier: number;
  /** Brier score of a forecast that gives every stage equal odds (0.75). */
  baselineBrier: number;
  distribution: Record<Stage, number>;
  casesUsed: number;
  lowEvidence: boolean;
  forecast: ForecastResult;
  challenger: ChallengerNotes;
};

export type CalibrationBin = { from: number; to: number; meanPredicted: number; observed: number; count: number };

export type BacktestReport = BacktestRun & {
  /** Every cutoff year tried for this industry, each scored against what happened next. */
  sweep: { cutoffYear: number; predicted: Stage; actual: Stage; hit: boolean; brier: number; probability: number }[];
  meanBrier: number;
  hitRate: number;
  windowRate: number;
  calibration: CalibrationBin[];
  note: string;
};

export function brierScore(dist: Record<Stage, number>, actual: Stage): number {
  return round(STAGES.reduce((s, k) => s + Math.pow(dist[k] - (k === actual ? 1 : 0), 2), 0), 4);
}
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** Runs the forecaster using only cases dated before the cutoff, then compares with what actually happened next. */
export async function backtestOnce(industry: string, jobs: string[], allCases: Case[], cutoffYear: number): Promise<BacktestRun> {
  const own = sortCases(allCases.filter((c) => c.industry === industry));
  const before = casesBefore(own, cutoffYear);
  if (before.length === 0) throw new Error(`No ${industry} cases exist before ${cutoffYear}, so there is nothing to forecast from.`);
  const next = own.find((c) => c.year >= cutoffYear);
  if (!next) throw new Error(`No ${industry} case exists from ${cutoffYear} onward, so there is nothing to compare against.`);

  const last = before[before.length - 1];
  const scores = pressureFromCases(own, jobs, cutoffYear);
  const f = forecast({
    industry, scores, cases: allCases, cutoffYear, stage: last.stage,
    stageBasis: `The latest recorded case before ${cutoffYear} (${last.year}) was at the "${last.stage}" stage.`,
    stageSinceYear: last.year,
  });
  const usedIndustries = new Set(casesBefore(allCases, cutoffYear).map((c) => c.industry)).size;
  const challenger = await challenge({ forecast: f, scores, signals: [], industriesCovered: usedIndustries, pressureFromCases: true }, null);
  return {
    industry, cutoffYear, stage: last.stage, predicted: f.nextLayer, actual: next.stage, actualYear: next.year, actualWhat: next.what_created,
    hit: f.nextLayer === next.stage,
    inWindow: next.year >= Math.floor(f.window.startYear) && next.year <= Math.ceil(f.window.endYear), brier: brierScore(f.distribution, next.stage), baselineBrier: round(1 - 1 / STAGES.length),
    distribution: f.distribution, casesUsed: f.casesUsed, lowEvidence: f.lowEvidence, forecast: f, challenger,
  };
}

/** Bins every (predicted probability, did it happen) pair into 5 bands: "when it says 70%, does it happen about 70% of the time?" */
export function calibrationTable(runs: { distribution: Record<Stage, number>; actual: Stage }[], bins = 5): CalibrationBin[] {
  const pairs = runs.flatMap((r) => STAGES.map((k) => ({ p: r.distribution[k], o: k === r.actual ? 1 : 0 })));
  const out: CalibrationBin[] = [];
  for (let i = 0; i < bins; i++) {
    const from = i / bins, to = (i + 1) / bins;
    const inBin = pairs.filter((x) => x.p >= from && (i === bins - 1 ? x.p <= to : x.p < to));
    out.push({
      from, to, count: inBin.length,
      meanPredicted: inBin.length ? round(inBin.reduce((s, x) => s + x.p, 0) / inBin.length) : 0,
      observed: inBin.length ? round(inBin.reduce((s, x) => s + x.o, 0) / inBin.length) : 0,
    });
  }
  return out;
}

/** Headline backtest at one cutoff, plus a sweep over every earlier year with data so calibration has enough points. */
export async function runBacktest(industry: string, jobs: string[], allCases: Case[], cutoffYear: number): Promise<BacktestReport> {
  const headline = await backtestOnce(industry, jobs, allCases, cutoffYear);
  const years = [...new Set(allCases.filter((c) => c.industry === industry).map((c) => c.year))].sort((a, b) => a - b);
  const runs: BacktestRun[] = [];
  for (const y of years.slice(2)) {
    if (!allCases.some((c) => c.industry === industry && c.year >= y)) continue;
    try { runs.push(await backtestOnce(industry, jobs, allCases, y)); } catch { /* not enough data for this cutoff */ }
  }
  const sweep = runs.map((r) => ({ cutoffYear: r.cutoffYear, predicted: r.predicted, actual: r.actual, hit: r.hit, brier: r.brier, probability: r.forecast.probability }));
  return {
    ...headline,
    sweep,
    meanBrier: runs.length ? round(runs.reduce((s, r) => s + r.brier, 0) / runs.length) : headline.brier,
    hitRate: runs.length ? round(runs.filter((r) => r.hit).length / runs.length) : headline.hit ? 1 : 0,
    windowRate: runs.length ? round(runs.filter((r) => r.inWindow).length / runs.length) : headline.inWindow ? 1 : 0,
    calibration: calibrationTable(runs.length ? runs : [headline]),
    note: `Small sample: ${runs.length} cutoffs tested. A calibration table from this few forecasts is a rough check, not proof.`,
  };
}
