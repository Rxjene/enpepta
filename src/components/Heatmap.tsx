import { DRIVERS, DRIVER_LABELS, type ScoreMatrix } from "@/agent/types";
import { GLOSSARY } from "@/lib/glossary";
import { Term } from "./Term";

export function Heatmap({ scores }: { scores: ScoreMatrix }) {
  const jobs = Object.keys(scores);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="mb-2 text-left text-slate-600">
          Pressure from 0 (none found) to 10 (severe). Each job is a row; the six <Term def={GLOSSARY.driver}>drivers</Term> are columns.
        </caption>
        <thead>
          <tr>
            <th className="p-2 text-left font-medium">Job</th>
            {DRIVERS.map((d) => (
              <th key={d} className="p-2 text-center font-medium">{DRIVER_LABELS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j}>
              <th scope="row" className="p-2 text-left font-normal">{j}</th>
              {DRIVERS.map((d) => {
                const v = scores[j][d];
                return (
                  <td key={d} className="border border-white p-2 text-center tabular-nums" style={{ background: `rgba(29,78,216,${(v / 10) * 0.9 + 0.03})`, color: v > 4.5 ? "#fff" : "#0f172a" }}>
                    {v.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
