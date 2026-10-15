// Usage: npm run backtest -- --industry banking --cutoff 1925
import { runBacktest } from "../src/agent/backtest";
import { loadSeedCases, loadSeedIndustries } from "../src/agent/case-library";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const industry = arg("industry") ?? "banking";
  const cutoff = Number(arg("cutoff") ?? 1925);
  const seed = loadSeedIndustries().find((s) => s.industry.toLowerCase() === industry.toLowerCase());
  if (!seed || Number.isNaN(cutoff)) throw new Error(`Usage: --industry <${loadSeedIndustries().map((s) => s.industry).join("|")}> --cutoff <year>`);

  const r = await runBacktest(seed.industry, seed.jobs, loadSeedCases(), cutoff);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  console.log(`Backtest: ${r.industry}, cutoff ${r.cutoffYear} (only cases before ${r.cutoffYear} used)`);
  console.log(`  Stage at cutoff:   ${r.stage}`);
  console.log(`  Predicted next:    ${r.predicted} (${pct(r.forecast.probability)}), window ${r.forecast.window.startYear} to ${r.forecast.window.endYear}`);
  console.log(`  What happened:     ${r.actual} in ${r.actualYear} - ${r.actualWhat}`);
  console.log(`  Real event inside window: ${r.inWindow ? "yes" : "no"}`);
  console.log(`  Result:            ${r.hit ? "HIT" : "MISS"}`);
  console.log(`  Brier score:       ${r.brier} (lower is better, 0 is perfect; equal-odds guess = ${r.baselineBrier})`);
  console.log(`  Cases relied on:   ${r.casesUsed}${r.lowEvidence ? " (LOW EVIDENCE)" : ""}`);
  console.log(`\nAll cutoffs for ${r.industry}: hit rate ${pct(r.hitRate)}, mean Brier ${r.meanBrier}, event inside window ${pct(r.windowRate)}`);
  console.log("Calibration (says X%, happens Y% of the time):");
  for (const b of r.calibration) console.log(`  ${pct(b.from)}-${pct(b.to)}: said ${pct(b.meanPredicted)}, happened ${pct(b.observed)} (n=${b.count})`);
  console.log(`\n${r.note}`);

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { saveBacktest } = await import("../src/lib/backtest-store");
    await saveBacktest(r);
    console.log("Saved to Supabase.");
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
