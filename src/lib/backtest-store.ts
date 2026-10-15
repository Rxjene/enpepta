import { adminClient } from "./supabase/server";
import type { BacktestReport } from "@/agent/backtest";

/** Saves a backtest with the service role (backtests are readable by everyone, writable by nobody else). */
export async function saveBacktest(r: BacktestReport): Promise<string | null> {
  const db = adminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("backtests")
    .insert({
      industry: r.industry, cutoff_year: r.cutoffYear, predicted_layer: r.predicted, actual_layer: r.actual, hit: r.hit,
      brier: r.brier, baseline_brier: r.baselineBrier, calibration: r.calibration, cases_used: r.casesUsed, low_evidence: r.lowEvidence,
      model_version: r.forecast.modelVersion,
      detail: { sweep: r.sweep, meanBrier: r.meanBrier, hitRate: r.hitRate, windowRate: r.windowRate, actualYear: r.actualYear, actualWhat: r.actualWhat, distribution: r.distribution, probability: r.forecast.probability, note: r.note },
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save backtest: ${error.message}`);
  return data.id as string;
}
