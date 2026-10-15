import { fetchCases, filterCases, loadSeedCases } from "@/agent/case-library";
import { DRIVERS, DRIVER_LABELS, STAGES, STAGE_LABELS, type Driver, type Stage } from "@/agent/types";
import { Term } from "@/components/Term";
import { formatYear } from "@/lib/dates";
import { GLOSSARY } from "@/lib/glossary";
import { userClient } from "@/lib/supabase/server";

type SP = { industry?: string; driver?: string; stage?: string; q?: string };

export default async function Cases({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const db = await userClient();
  const all = await fetchCases(db as never).catch(() => loadSeedCases()).then((c) => (c.length ? c : loadSeedCases()));
  const industries = [...new Set(all.map((c) => c.industry))];
  const rows = filterCases(all, {
    industry: sp.industry || undefined,
    driver: DRIVERS.includes(sp.driver as Driver) ? (sp.driver as Driver) : undefined,
    stage: STAGES.includes(sp.stage as Stage) ? (sp.stage as Stage) : undefined,
    q: sp.q,
  });
  const sel = "rounded border p-2 text-sm";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Case library</h1>
      <p className="max-w-2xl text-slate-700">Past disruptions in four industries. Each shows the <Term def={GLOSSARY.stage}>stage</Term> it belongs to and the main <Term def={GLOSSARY.driver}>driver</Term>. The library is read-only; items marked “approximate” have uncertain dates.</p>
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search text" aria-label="Search text" className={sel} />
        <select name="industry" defaultValue={sp.industry ?? ""} aria-label="Industry" className={sel}><option value="">All industries</option>{industries.map((i) => <option key={i}>{i}</option>)}</select>
        <select name="driver" defaultValue={sp.driver ?? ""} aria-label="Driver" className={sel}><option value="">All drivers</option>{DRIVERS.map((d) => <option key={d} value={d}>{DRIVER_LABELS[d]}</option>)}</select>
        <select name="stage" defaultValue={sp.stage ?? ""} aria-label="Stage" className={sel}><option value="">All stages</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select>
        <button className="rounded bg-blue-700 px-4 py-2 text-sm text-white">Filter</button>
      </form>
      <p className="text-sm text-slate-600">{rows.length} of {all.length} cases</p>
      <div className="overflow-x-auto rounded bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2">Year</th><th className="p-2">Industry</th><th className="p-2">Stage</th><th className="p-2">Main driver</th><th className="p-2">Also</th><th className="p-2">What happened or was created</th><th className="p-2">Source</th></tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i} className="border-t align-top">
                <td className="whitespace-nowrap p-2">{c.approximate ? "c. " : ""}{formatYear(c.year)}{c.approximate && <span className="ml-1 rounded bg-amber-100 px-1 text-xs">approximate</span>}</td>
                <td className="p-2">{c.industry}</td>
                <td className="p-2">{STAGE_LABELS[c.stage]}</td>
                <td className="p-2">{DRIVER_LABELS[c.main_driver]}</td>
                <td className="p-2">{c.supporting_drivers.map((d) => DRIVER_LABELS[d]).join(", ") || "—"}</td>
                <td className="p-2">{c.what_created}</td>
                <td className="p-2 text-slate-600">{c.source_url ? <a className="text-blue-800 underline" href={c.source_url}>{c.source}</a> : c.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
