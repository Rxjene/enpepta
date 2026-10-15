/** 2027.5 -> "2027-07-02". Used to store the forecast window as dates. */
export function yearFracToIso(y: number): string {
  const year = Math.floor(y);
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(d.getUTCDate() + Math.round((y - year) * 365));
  return d.toISOString().slice(0, 10);
}
export function isoToYearFrac(iso: string): number {
  const d = new Date(iso + "T00:00:00Z");
  const y = d.getUTCFullYear();
  return y + (d.getTime() - Date.UTC(y, 0, 1)) / (365 * 86400000);
}
export function formatYear(y: number): string {
  if (y < 0) return `${Math.abs(Math.round(y))} BC`;
  return String(Math.round(y * 10) / 10);
}
