import { z } from "zod";

export const DRIVERS = ["growth", "security", "government", "stability", "technology", "trust"] as const;
export type Driver = (typeof DRIVERS)[number];
export const DRIVER_LABELS: Record<Driver, string> = {
  growth: "Economic growth",
  security: "Security",
  government: "Government need",
  stability: "Stability",
  technology: "Technology",
  trust: "Trust",
};

/** Order of the observed pattern: expansion, then incident, then protective layer, then rule. */
export const STAGES = ["expansion", "incident", "protective_layer", "rule"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  expansion: "Expansion",
  incident: "Incident",
  protective_layer: "Protective layer",
  rule: "Rule",
};
/** The stage that normally follows each stage in the observed pattern. */
export const NEXT_STAGE: Record<Stage, Stage> = {
  expansion: "incident",
  incident: "protective_layer",
  protective_layer: "rule",
  rule: "expansion",
};

export const driverSchema = z.enum(DRIVERS);
export const stageSchema = z.enum(STAGES);

export const caseSchema = z.object({
  industry: z.string().min(1),
  year: z.number().int(), // negative = BC
  job: z.string().min(1),
  main_driver: driverSchema,
  supporting_drivers: z.array(driverSchema),
  stage: stageSchema,
  what_created: z.string().min(1),
  source: z.string().min(1, "Every case must cite a source"),
  source_url: z.string().url().nullish(),
  approximate: z.boolean(),
});
export type Case = z.infer<typeof caseSchema>;

export const signalSchema = z.object({
  industry: z.string().min(1),
  job: z.string().min(1),
  driver: driverSchema,
  description: z.string().min(1),
  /** 1 (weak hint) to 5 (severe, widespread). Classified by the language model against docs/rubric.md. */
  strength: z.number().int().min(1).max(5),
  source_url: z.string().url().nullish(),
  /** ISO date (YYYY-MM-DD) the evidence was observed or published. */
  observed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unsourced: z.boolean().optional(),
});
export type Signal = z.infer<typeof signalSchema>;

/** Scores keyed by job name then driver, each 0 to 10. */
export type ScoreMatrix = Record<string, Record<Driver, number>>;

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const feasibilitySchema = z.object({
  responsible: z.object({ answer: z.string(), confidence: confidenceSchema }),
  regulator: z.object({ answer: z.string(), confidence: confidenceSchema }),
  trust: z.object({ answer: z.string(), confidence: confidenceSchema }),
});
export type Feasibility = z.infer<typeof feasibilitySchema>;

export const MODEL_VERSION = "forecaster-v1";
