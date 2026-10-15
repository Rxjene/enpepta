import { runBacktest } from "@/agent/backtest";
import { loadSeedCases, loadSeedIndustries } from "@/agent/case-library";
import { STAGE_LABELS } from "@/agent/types";
import { CalibrationChart } from "@/components/CalibrationChart";
import { Term } from "@/components/Term";
import { GLOSSARY } from "@/lib/glossary";
import { BacktestRunner } from "@/components/BacktestRunner";

export default async function BacktestPage({ searchParams }: { searchParams: Promise<{ industry?: string; cutoff?: string }> }) {
  const sp = await searchParams;
  const seeds = loadSeedIndustries();
  const seed = seeds.find((s) => s.industry.toLowerCase() === (sp.industry ?? "banking").toLowerCase()) ?? seeds[0];
  const cutoff = Number(sp.cutoff) || (seed.industry === "banking" ? 1925 : seed.cases[Math.floor(seed.cases.length / 2)].year);
  let report = null, error = "";
  try { report = await runBacktest(seed.industry, seed.jobs, loadSeedCases(), cutoff); } catch (e) { error = e instanceof Error ? e.message : "Backtest failed"; }
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Backtests: does the forecaster work on the past?</h1>
      <p className="max-w-2xl text-slate-700">
        A <Term def={GLOSSARY.backtest}>backtest</Term> pretends it is a past year (the <Term def={GLOSSARY.cutoff}>cutoff</Term>), shows the forecaster only older cases, then checks its answer against what really happened next. Scores below are computed fresh from the case library.
      </p>
      <form className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Industry<select name="industry" defaultValue={seed.industry} className="mt-1 block rounded border p-2">{seeds.map((s) => <option key={s.industry}>{s.industry}</option>)}</select></label>
        <label className="text-sm">Cutoff year<input name="cutoff" type="number" defaultValue={cutoff} className="mt-1 block w-28 rounded border p-2" /></label>
        <button className="rounded bg-blue-700 px-4 py-2 text-sm text-white">Run</button>
      </form>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {report && (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            {[["Result at this cutoff", report.hit ? "Hit" : "Miss"], ["Brier score (this run)", `${report.brier}`], ["Mean Brier, all cutoffs", `${report.meanBrier}`], ["Equal-odds guess", `${report.baselineBrier}`]].map(([k, v]) => (
              <div key={k} className="rounded bg-white p-3 shadow-sm"><div className="text-xs text-slate-600">{k}</div><div className="text-2xl font-semibold">{v}</div></div>
            ))}
          </section>
          <p className="text-sm text-slate-700">
            <Term def={GLOSSARY.brier}>Brier score</Term>: lower is better. At cutoff {report.cutoffYear} the industry was at the “{STAGE_LABELS[report.stage]}” stage. It predicted “{STAGE_LABELS[report.predicted]}” ({pct(report.forecast.probability)}), window {report.forecast.window.startYear} to {report.forecast.window.endYear}. What happened: “{STAGE_LABELS[report.actual]}” in {report.actualYear}, {report.actualWhat} The real event {report.inWindow ? "was inside" : "was outside"} the window. It used {report.casesUsed} comparable cases{report.lowEvidence ? " (low evidence)" : ""}.
          </p>
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Score table, every cutoff for {report.industry}</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left"><th>Cutoff</th><th>Predicted</th><th>Actual</th><th>Odds</th><th>Brier</th></tr></thead>
                <tbody>{report.sweep.map((r) => (<tr key={r.cutoffYear} className="border-t"><td>{r.cutoffYear}</td><td>{STAGE_LABELS[r.predicted]}</td><td>{STAGE_LABELS[r.actual]} {r.hit ? "✓" : "✗"}</td><td>{pct(r.probability)}</td><td>{r.brier}</td></tr>))}</tbody>
              </table>
              <p className="mt-2 text-sm text-slate-600">Hit rate {pct(report.hitRate)}; real event inside the window {pct(report.windowRate)}.</p>
            </div>
            <div className="rounded bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-semibold"><Term def={GLOSSARY.calibration}>Calibration</Term></h2>
              <CalibrationChart bins={report.calibration} />
              <table className="mt-2 w-full text-sm"><thead><tr className="text-left"><th>Said</th><th>Happened</th><th>Forecasts</th></tr></thead>
                <tbody>{report.calibration.filter((b) => b.count).map((b) => (<tr key={b.from} className="border-t"><td>{pct(b.meanPredicted)}</td><td>{pct(b.observed)}</td><td>{b.count}</td></tr>))}</tbody></table>
            </div>
          </section>
          <p className="rounded bg-amber-50 p-3 text-sm">{report.note} The pressure for each past year is rebuilt from the case record itself, so this tests the method, not live data collection. Some cases (such as the 1921 credit boom) were recorded with hindsight.</p>
          <BacktestRunner industry={report.industry} cutoff={report.cutoffYear} />
        </>
      )}
    </div>
  );
}
