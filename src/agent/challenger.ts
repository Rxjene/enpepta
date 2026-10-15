import { z } from "zod";
import type { ForecastResult } from "./forecaster";
import type { LlmClient } from "./llm";
import { DRIVERS, STAGE_LABELS, type ScoreMatrix, type Signal } from "./types";
import { sourcedShare } from "./pressure-scorer";

export type ChallengerNotes = {
  missingInformation: string[];
  rareShocks: string[];
  weakCases: string[];
  counterArguments: string[];
  narrative: string | null;
};

/** Always included, written by code so the language model cannot leave it out. */
export const RARE_SHOCK_NOTE =
  "Rare shocks cannot be predicted from this pattern. A pandemic, a war, a major cyber-attack or a sudden political change could cause or prevent a disruption that no past case in this library would suggest.";

export type ChallengerInput = {
  forecast: ForecastResult;
  scores: ScoreMatrix;
  signals: Signal[];
  /** How many different industries contributed comparable cases. */
  industriesCovered: number;
  /** True when pressure was rebuilt from the case record instead of live signals (backtests). */
  pressureFromCases?: boolean;
};

/** Second pass that argues against the forecast. Facts are computed in code; the model may add a short argument. */
export async function challenge(input: ChallengerInput, llm: LlmClient | null): Promise<ChallengerNotes> {
  const { forecast: f } = input;
  const missing: string[] = [];
  const weak: string[] = [];
  const counter: string[] = [];

  if (!input.pressureFromCases) {
    if (input.signals.length === 0) missing.push("No current signals were collected, so today's pressure is not measured at all.");
    const empty = DRIVERS.filter((d) => f.drivers[d] === 0);
    if (empty.length && input.signals.length) missing.push(`No evidence was found for these drivers: ${empty.join(", ")}. They may be quiet, or just not searched.`);
    if (input.signals.length && sourcedShare(input.signals) < 0.7)
      missing.push(`Only ${Math.round(sourcedShare(input.signals) * 100)}% of signals have a source link; the rest count at half weight.`);
  } else {
    missing.push("Pressure was rebuilt from the historical case record, not measured from live data, so it only reflects what later historians recorded.");
  }
  if (f.lowEvidence) missing.push(`Only ${f.casesUsed} comparable past case${f.casesUsed === 1 ? "" : "s"} exist (fewer than 5), so the odds lean heavily on the general pattern and the window is widened.`);
  if (f.stageBasis) missing.push(`The current stage ("${STAGE_LABELS[f.stage]}") rests on this basis: ${f.stageBasis}`);
  if (input.industriesCovered < 2) missing.push("Comparable cases come from a single industry; patterns may not carry across industries.");

  const top = f.influences[0];
  if (top && top.share >= 0.35)
    weak.push(`The forecast leans on one case for ${Math.round(top.share * 100)}% of its weight: ${top.industry}, ${top.year < 0 ? `${-top.year} BC` : top.year} ("${top.what}"). If that case is unrepresentative, the forecast is weak.`);
  if (f.casesUsed > 0 && f.casesUsed < 8) weak.push(`The whole forecast rests on ${f.casesUsed} past cases; a single additional case could change it.`);

  const others = f.casesUsed - Math.round(f.casesUsed * f.distribution[f.nextLayer]);
  if (f.casesUsed > 0 && f.probability < 0.75) counter.push(`The probability is ${Math.round(f.probability * 100)}%, so roughly ${100 - Math.round(f.probability * 100)}% of the odds point to something else, such as "${STAGE_LABELS[Object.entries(f.distribution).filter(([k]) => k !== f.nextLayer).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof STAGE_LABELS]}".`);
  if (others > 0) counter.push(`Around ${others} of ${f.casesUsed} comparable past cases did not follow the expected pattern.`);
  counter.push("Regulators and companies learn from past crises; the gaps may keep shrinking, or a pre-emptive fix may mean the next step never appears as a distinct event.");

  let narrative: string | null = null;
  if (llm) {
    try {
      const out = await llm.json({
        system: "You are a sceptical reviewer. In under 90 words, argue in plain English against the forecast using only the facts given. Do not invent facts or numbers.",
        user: JSON.stringify({ forecast: { industry: f.industry, stage: f.stage, next: f.nextLayer, probability: f.probability, casesUsed: f.casesUsed, facts: f.facts }, missing, weak, counter }),
        schema: z.object({ argument: z.string().min(20).max(900) }),
        toolName: "return_argument",
      });
      narrative = out.argument;
    } catch {
      narrative = null;
    }
  }
  return { missingInformation: missing, rareShocks: [RARE_SHOCK_NOTE], weakCases: weak, counterArguments: counter, narrative };
}
