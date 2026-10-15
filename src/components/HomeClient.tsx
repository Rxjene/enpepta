"use client";
import Link from "next/link";
import { useState } from "react";
import { STAGES, STAGE_LABELS } from "@/agent/types";
import { GLOSSARY } from "@/lib/glossary";
import { Term } from "./Term";

type Job = { name: string; description: string };
type Existing = { id: string; name: string; jobs: Job[]; forecastId?: string | null };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Something went wrong");
  return j;
}

export function HomeClient({ signedIn, configured, existing }: { signedIn: boolean; configured: boolean; existing: Existing[] }) {
  const [name, setName] = useState("");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const disabled = !configured || !signedIn;

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label); setMsg("");
    try { return await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">What will break next, and when?</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Enter any industry that serves the public. The agent lists its constant <Term def={GLOSSARY.job}>jobs</Term>, scores today&apos;s pressure on each, compares it with past disruptions, and gives odds for the next step in the usual pattern:
          {" "}{STAGES.map((s) => STAGE_LABELS[s].toLowerCase()).join(", then ")}.
        </p>
        {!configured && <p className="mt-3 rounded bg-amber-100 p-3 text-sm">The database is not connected yet, so saving is switched off. You can still browse the <Link className="underline" href="/cases">case library</Link> and <Link className="underline" href="/backtest">backtests</Link>.</p>}
        {configured && !signedIn && <p className="mt-3 rounded bg-amber-100 p-3 text-sm"><Link className="underline" href="/login">Sign in</Link> to map an industry and save forecasts.</p>}
      </section>

      <section className="rounded bg-white p-4 shadow-sm">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); run("Mapping", async () => { const r = await post("/api/industries/map", { name }); setName(r.industry); setJobs(r.jobs); }); }}
        >
          <label className="sr-only" htmlFor="industry">Industry name</label>
          <input id="industry" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. banking, hospitals, post offices, tax departments" className="min-w-64 flex-1 rounded border p-2" />
          <button disabled={disabled || !name.trim() || !!busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy === "Mapping" ? "Mapping…" : "Map its jobs"}</button>
        </form>

        {jobs && (
          <div className="mt-4 space-y-2">
            <h2 className="font-medium">Its constant jobs (edit before saving; 4 to 7)</h2>
            {jobs.map((j, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Job ${i + 1} name`} value={j.name} onChange={(e) => setJobs(jobs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="w-1/3 rounded border p-2" />
                <input aria-label={`Job ${i + 1} description`} value={j.description} onChange={(e) => setJobs(jobs.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} className="flex-1 rounded border p-2" />
                <button aria-label={`Remove job ${i + 1}`} className="px-2 text-slate-600" onClick={() => setJobs(jobs.filter((_, k) => k !== i))}>✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              {jobs.length < 7 && <button className="rounded border px-3 py-1 text-sm" onClick={() => setJobs([...jobs, { name: "", description: "" }])}>Add a job</button>}
              <button
                disabled={!!busy}
                className="rounded bg-blue-700 px-4 py-1 text-white disabled:opacity-50"
                onClick={() => run("Saving", async () => { await post("/api/industries", { name, jobs }); location.reload(); })}
              >{busy === "Saving" ? "Saving…" : "Save industry"}</button>
            </div>
          </div>
        )}
        {msg && <p role="alert" className="mt-3 text-sm text-red-700">{msg}</p>}
      </section>

      {existing.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your industries</h2>
          {existing.map((ind) => (
            <IndustryCard key={ind.id} ind={ind} disabled={disabled} />
          ))}
        </section>
      )}
    </div>
  );
}

function IndustryCard({ ind, disabled }: { ind: Existing; disabled: boolean }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label); setMsg("");
    try { const r = await fn(); if (r) setMsg(r); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  }
  return (
    <div className="rounded bg-white p-4 shadow-sm">
      <h3 className="font-medium">{ind.name}</h3>
      <p className="text-sm text-slate-600">{ind.jobs.map((j) => j.name).join(" · ")}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-blue-800">Add evidence (<Term def={GLOSSARY.signal}>signals</Term>)</summary>
        <div className="mt-2 space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste text from a public report or article. Public information only." className="w-full rounded border p-2 text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Source link (optional). Without one, signals count at half weight" className="w-full rounded border p-2 text-sm" />
          <input type="file" accept=".txt,.md" aria-label="Upload a text file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} className="text-sm" />
          <div className="flex gap-2">
            <button disabled={disabled || text.length < 20 || !!busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => run("doc", async () => { const r = await post(`/api/industries/${ind.id}/signals`, { mode: "document", text, sourceUrl: url }); return `Added ${r.added} signals (${r.unsourced} without a source).`; })}>
              {busy === "doc" ? "Reading…" : "Extract signals from text"}
            </button>
            <button disabled={disabled || !!busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => run("web", async () => { const r = await post(`/api/industries/${ind.id}/signals`, { mode: "web" }); return r.note ?? `Added ${r.added} signals (${r.unsourced} without a source).`; })}>
              {busy === "web" ? "Searching…" : "Search the web"}
            </button>
          </div>
        </div>
      </details>
      <div className="mt-3 flex items-center gap-3">
        <button disabled={disabled || !!busy} className="rounded bg-blue-700 px-4 py-1 text-white disabled:opacity-50"
          onClick={() => run("fc", async () => { const r = await post(`/api/industries/${ind.id}/forecast`, {}); location.href = `/forecast/${r.id}`; })}>
          {busy === "fc" ? "Forecasting…" : "Run forecast"}
        </button>
        {ind.forecastId && <Link className="text-sm text-blue-800 underline" href={`/forecast/${ind.forecastId}`}>Latest forecast</Link>}
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
