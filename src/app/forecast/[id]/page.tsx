import Link from "next/link";
import { notFound } from "next/navigation";
import type { ChallengerNotes } from "@/agent/challenger";
import { STAGE_LABELS, type Feasibility, type ScoreMatrix, type Stage } from "@/agent/types";
import { Heatmap } from "@/components/Heatmap";
import { StageIndicator } from "@/components/StageIndicator";
import { Term } from "@/components/Term";
import { formatYear, isoToYearFrac } from "@/lib/dates";
import { latestBacktest } from "@/lib/forecast-service";
import { GLOSSARY } from "@/lib/glossary";
import { currentUser } from "@/lib/supabase/server";

type PS = { matrix: ScoreMatrix; stageBasis: string; timingThin: boolean; medianYear: number; signalCount: number; unsourcedCount: number; influences: { industry: string; year: number; what: string; share: number }[] };

export default async function ForecastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await currentUser();
  if (!db) notFound();
  const { data: f } = await db.from("forecasts").select("*, industries(name)").eq("id", id).maybeSingle(); // row-level security: own forecasts only
  if (!f) notFound();
  const name = (f.industries as { name: string }).name;
  const ps = f.pressure_scores as PS;
  const notes = f.challenger_notes as ChallengerNotes | null;
  const fe = f.feasibility as Feasibility | null;
  const bt = await latestBacktest(db, name);
  const pct = Math.round(Number(f.probability) * 100);
  const start = formatYear(isoToYearFrac(f.window_start)), end = formatYear(isoToYearFrac(f.window_end));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm"><Link href="/" className="text-blue-800 underline">← Home</Link></p>
        <h1 className="text-2xl font-semibold capitalize">{name}: what is likely next</h1>
      </div>

      <section className="rounded border-l-4 border-blue-700 bg-white p-4 shadow-sm" aria-label="Backtest record">
        {bt ? (
          <p>
            <Term def={GLOSSARY.backtest}>Backtest</Term> record for {name}: cutoff {bt.cutoff_year}, <Term def={GLOSSARY.brier}>Brier score</Term> {Number(bt.brier).toFixed(2)} (equal-odds guess: {Number(bt.baseline_brier).toFixed(2)}), {bt.hit ? "hit" : "miss"}.{" "}
            <Link className="text-blue-800 underline" href={`/backtest?industry=${encodeURIComponent(name)}`}>See full backtest</Link>
          </p>
        ) : (
          <p><strong>Not yet backtested.</strong> There is no track record for this industry, so treat these odds with extra care. <Link className="text-blue-800 underline" href="/backtest">About backtests</Link></p>
        )}
      </section>

      <section className="space-y-3 rounded bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Where it is now (<Term def={GLOSSARY.stage}>stage</Term>)</h2>
        <StageIndicator stage={f.stage as Stage} next={f.next_layer as Stage} />
        <p className="text-sm text-slate-600">{ps.stageBasis}</p>
      </section>

      <section className="space-y-2 rounded bg-white p-4 shadow-sm">
        <h2 className="font-semibold">The odds</h2>
        <p className="text-3xl font-semibold">{pct}% <span className="text-lg font-normal">that the next step is: {STAGE_LABELS[f.next_layer as Stage].toLowerCase()}</span></p>
        <p>Likely time window: <strong>{start} to {end}</strong> (middle estimate {formatYear(ps.medianYear)}).</p>
        <p className="text-sm text-slate-700">
          Relied on <strong>{f.cases_used}</strong> comparable past cases.{" "}
          {f.low_evidence && <span className="rounded bg-amber-100 px-2 py-0.5 font-medium"><Term def={GLOSSARY.lowEvidence}>Low evidence</Term></span>}
          {ps.timingThin && " The time window is wider because few past gaps exist."}
        </p>
        <p className="text-sm text-slate-600">These are odds with reasons, not a prediction of certainty.</p>
        <h3 className="pt-2 font-medium">Top three reasons</h3>
        <ol className="list-decimal space-y-1 pl-5">{(f.reasons as string[]).map((r, i) => <li key={i}>{r}</li>)}</ol>
      </section>

      <section className="rounded bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Today&apos;s pressure</h2>
        <Heatmap scores={ps.matrix} />
        <p className="mt-2 text-sm text-slate-600">Built from {ps.signalCount} <Term def={GLOSSARY.signal}>signals</Term>; {ps.unsourcedCount} <Term def={GLOSSARY.unsourced}>without a source</Term>.</p>
      </section>

      {notes && (
        <section className="rounded border border-red-200 bg-red-50 p-4" aria-label="Challenger notes">
          <h2 className="font-semibold">The challenger: reasons to doubt this</h2>
          {notes.narrative && <p className="mt-2">{notes.narrative}</p>}
          {([["Missing information", notes.missingInformation], ["Leans on weak cases", notes.weakCases], ["Other ways it could go", notes.counterArguments], ["Rare shocks", notes.rareShocks]] as const).map(([title, items]) =>
            items.length ? (
              <div key={title} className="mt-3">
                <h3 className="text-sm font-medium">{title}</h3>
                <ul className="list-disc pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            ) : null,
          )}
        </section>
      )}

      {fe && (
        <section className="rounded bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Feasibility questions</h2>
          {([["Who will be responsible when this fails?", fe.responsible], ["Which regulator or government body will most likely end up with it?", fe.regulator], ["What will make everyday users trust it?", fe.trust]] as const).map(([q, a]) => (
            <div key={q} className="mt-3">
              <h3 className="text-sm font-medium">{q}</h3>
              <p>{a.answer} <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 text-xs">Confidence: {a.confidence}</span></p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
