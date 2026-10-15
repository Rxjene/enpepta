import { STAGES, STAGE_LABELS, type Stage } from "@/agent/types";

export function StageIndicator({ stage, next }: { stage: Stage; next: Stage }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Where the industry is in the usual pattern">
      {STAGES.map((s, i) => (
        <li key={s} className={`rounded border px-3 py-2 text-sm ${s === stage ? "border-blue-700 bg-blue-700 text-white" : s === next ? "border-dashed border-blue-700 text-blue-800" : "border-slate-300 text-slate-600"}`}>
          {i + 1}. {STAGE_LABELS[s]}
          {s === stage && <span className="ml-2 text-xs">(now)</span>}
          {s === next && s !== stage && <span className="ml-2 text-xs">(likely next)</span>}
        </li>
      ))}
    </ol>
  );
}
