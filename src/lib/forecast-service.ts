import type { SupabaseClient } from "@supabase/supabase-js";
import { challenge } from "@/agent/challenger";
import { fetchCases } from "@/agent/case-library";
import { feasibility } from "@/agent/feasibility";
import { forecast, inferStageFromPressure, writeReasons } from "@/agent/forecaster";
import type { LlmClient } from "@/agent/llm";
import { driverSummary, scorePressure } from "@/agent/pressure-scorer";
import { MODEL_VERSION, type Signal, type Stage } from "@/agent/types";
import { yearFracToIso } from "./dates";

/** Latest saved backtest for an industry, or null. Every forecast links to this or shows "not yet backtested". */
export async function latestBacktest(db: SupabaseClient | null, industry: string) {
  if (!db) return null;
  const { data } = await db
    .from("backtests")
    .select("id, industry, cutoff_year, hit, brier, baseline_brier, created_at, detail")
    .ilike("industry", industry)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function createForecast(args: {
  db: SupabaseClient;
  userId: string;
  industry: { id: string; name: string };
  jobs: string[];
  signals: Signal[];
  stageOverride?: Stage;
  llm: LlmClient | null;
  now?: Date;
}): Promise<string> {
  const { db, industry, jobs, signals, llm } = args;
  const now = args.now ?? new Date();
  const scores = scorePressure(signals, jobs, now);
  const inferred = inferStageFromPressure(scores);
  const stage = args.stageOverride ?? inferred.stage;
  const stageBasis = args.stageOverride ? "Chosen by the person who ran this forecast." : inferred.basis;

  let cases = await fetchCases(db).catch(() => []);
  if (cases.length === 0) cases = await fetchCases(null);

  const f = forecast({ industry: industry.name, scores, cases, cutoffYear: now.getUTCFullYear() + 1, stage, stageBasis, stageSinceYear: now.getUTCFullYear() + now.getUTCMonth() / 12 });
  const [reasons, notes, fe, bt] = await Promise.all([
    writeReasons(llm, f),
    challenge({ forecast: f, scores, signals, industriesCovered: new Set(cases.map((c) => c.industry)).size }, llm),
    feasibility(llm, f, cases.filter((c) => c.industry.toLowerCase() === industry.name.toLowerCase())),
    latestBacktest(db, industry.name),
  ]);

  const { data, error } = await db
    .from("forecasts")
    .insert({
      industry_id: industry.id, owner_id: args.userId, stage: f.stage, next_layer: f.nextLayer, probability: f.probability,
      distribution: f.distribution, window_start: yearFracToIso(f.window.startYear), window_end: yearFracToIso(f.window.endYear),
      reasons, cases_used: f.casesUsed, low_evidence: f.lowEvidence,
      pressure_scores: {
        matrix: scores, drivers: driverSummary(scores), stageBasis, influences: f.influences, timingThin: f.timingThin,
        medianYear: f.window.medianYear, signalCount: signals.length, unsourcedCount: signals.filter((s) => !s.source_url).length,
      },
      feasibility: fe, challenger_notes: notes, backtest_id: bt?.id ?? null, model_version: MODEL_VERSION,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save forecast: ${error.message}`);
  return data.id as string;
}
