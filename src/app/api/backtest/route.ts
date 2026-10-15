import { NextResponse } from "next/server";
import { z } from "zod";
import { runBacktest } from "@/agent/backtest";
import { fetchCases, loadSeedCases, loadSeedIndustries } from "@/agent/case-library";
import { fail } from "@/lib/api";
import { saveBacktest } from "@/lib/backtest-store";
import { adminClient, currentUser } from "@/lib/supabase/server";

const body = z.object({ industry: z.string().min(1), cutoff: z.number().int().min(-3000).max(2100) });

/** Runs the forecaster with only pre-cutoff cases and compares it to what happened next. Saves the result when the database is set up. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Send { industry, cutoff } where cutoff is a year.");
  const seed = loadSeedIndustries().find((s) => s.industry.toLowerCase() === parsed.data.industry.toLowerCase());
  if (!seed) return fail(`Backtests are available for: ${loadSeedIndustries().map((s) => s.industry).join(", ")}.`, 404);

  const { db, user } = await currentUser();
  if (db && !user) return fail("Please sign in to run and save a backtest.", 401);
  try {
    const admin = adminClient();
    const cases = admin ? await fetchCases(admin).catch(() => loadSeedCases()) : loadSeedCases();
    const report = await runBacktest(seed.industry, seed.jobs, cases.length ? cases : loadSeedCases(), parsed.data.cutoff);
    const id = await saveBacktest(report).catch(() => null);
    return NextResponse.json({ id, saved: Boolean(id), report });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Backtest failed", 422);
  }
}
