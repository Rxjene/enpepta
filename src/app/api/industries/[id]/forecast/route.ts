import { NextResponse } from "next/server";
import { z } from "zod";
import { createLlm } from "@/agent/llm";
import { signalSchema, stageSchema } from "@/agent/types";
import { fail, requireUser } from "@/lib/api";
import { createForecast } from "@/lib/forecast-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = z.object({ stage: stageSchema.optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return fail("Unknown stage.");

  const { data: ind } = await auth.db.from("industries").select("id, name, jobs(name, position)").eq("id", id).eq("owner_id", auth.user.id).maybeSingle();
  if (!ind) return fail("Industry not found.", 404);
  const { data: rows, error } = await auth.db.from("signals").select("job, driver, description, strength, source_url, observed_on").eq("industry_id", id);
  if (error) return fail(error.message, 500);
  const signals = z.array(signalSchema.omit({ industry: true })).parse(rows ?? []).map((s) => ({ ...s, industry: ind.name }));
  const jobs = [...(ind.jobs as { name: string; position: number }[])].sort((a, b) => a.position - b.position).map((j) => j.name);
  try {
    const forecastId = await createForecast({ db: auth.db, userId: auth.user.id, industry: { id, name: ind.name }, jobs, signals, stageOverride: body.data.stage, llm: createLlm() });
    return NextResponse.json({ id: forecastId });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Forecast failed", 500);
  }
}
