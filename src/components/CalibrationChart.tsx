import type { CalibrationBin } from "@/agent/backtest";

/** Dots on the diagonal mean the forecaster's odds matched reality. Dot size shows how many forecasts are in the band. */
export function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const S = 260, P = 34;
  const x = (v: number) => P + v * (S - P - 10);
  const y = (v: number) => S - P - v * (S - P - 10);
  const used = bins.filter((b) => b.count > 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-sm" role="img" aria-label="Calibration chart: said odds versus how often it happened">
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#94a3b8" strokeDasharray="4 3" />
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="#475569" />
        <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="#475569" />
        {[0, 0.5, 1].map((t) => (
          <g key={t} fontSize="9" fill="#475569">
            <text x={x(t)} y={S - P + 14} textAnchor="middle">{t * 100}%</text>
            <text x={P - 6} y={y(t) + 3} textAnchor="end">{t * 100}%</text>
          </g>
        ))}
        <text x={S / 2} y={S - 6} textAnchor="middle" fontSize="10" fill="#0f172a">What the forecaster said</text>
        <text transform={`translate(10 ${S / 2}) rotate(-90)`} textAnchor="middle" fontSize="10" fill="#0f172a">How often it happened</text>
        {used.map((b) => (
          <circle key={b.from} cx={x(b.meanPredicted)} cy={y(b.observed)} r={3 + Math.min(8, Math.sqrt(b.count))} fill="#1d4ed8" fillOpacity="0.75">
            <title>{`Said ${Math.round(b.meanPredicted * 100)}%, happened ${Math.round(b.observed * 100)}% (${b.count} forecasts)`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="text-sm text-slate-600">The dashed line is perfect calibration.</figcaption>
    </figure>
  );
}
