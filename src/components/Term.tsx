import type { ReactNode } from "react";

/** Shows a short definition on hover or keyboard focus. Use it the first time a technical term appears on a page. */
export function Term({ def, children }: { def: string; children: ReactNode }) {
  return (
    <span className="group relative inline-block">
      <span tabIndex={0} aria-describedby={undefined} title={def} className="cursor-help border-b border-dotted border-slate-500 outline-none focus:ring-2 focus:ring-blue-500">
        {children}
      </span>
      <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded bg-slate-900 p-2 text-xs font-normal normal-case text-white shadow group-focus-within:block group-hover:block">
        {def}
      </span>
    </span>
  );
}
