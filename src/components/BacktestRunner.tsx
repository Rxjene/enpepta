"use client";
import { useState } from "react";

/** Saves this backtest so forecasts can link to it (requires sign-in and a configured database). */
export function BacktestRunner({ industry, cutoff }: { industry: string; cutoff: number }) {
  const [msg, setMsg] = useState("");
  return (
    <div>
      <button className="rounded border px-3 py-2 text-sm" onClick={async () => {
        const res = await fetch("/api/backtest", { method: "POST", body: JSON.stringify({ industry, cutoff }) });
        const j = await res.json();
        setMsg(!res.ok ? j.error : j.saved ? "Saved. Forecasts for this industry will now link to this score." : "Computed, but not saved (database not configured).");
      }}>Save this backtest as the latest record</button>
      {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}
