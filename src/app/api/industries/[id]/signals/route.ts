import { NextResponse } from "next/server";
import { z } from "zod";
import { createLlm } from "@/agent/llm";
import { collectFromDocument, collectFromWeb } from "@/agent/signal-collector";
import { fail, requireUser } from "@/lib/api";

const body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("web") }),
  z.object({ mode: z.literal("document"), text: z.string().min(20).max(200000), sourceUrl: z.string().url().optional().or(z.literal("")) }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Paste at least a few sentences of document text, or choose web search.");
  const llm = createLlm();
  if (!llm) return fail("The language model is not configured (ANTHROPIC_API_KEY is missing).", 503);

  const { data: ind } = await auth.db.from("industries").select("id, name, jobs(name)").eq("id", id).eq("owner_id", auth.user.id).maybeSingle();
  if (!ind) return fail("Industry not found.", 404);
  const jobs = (ind.jobs as { name: string }[]).map((j) => j.name);
  const today = new Date();
  try {
    const signals =
      parsed.data.mode === "web"
        ? await collectFromWeb(llm, ind.name, jobs, today)
        : await collectFromDocument(llm, { industry: ind.name, jobs, text: parsed.data.text, sourceUrl: parsed.data.sourceUrl || null, today });
    if (signals.length) {
      const { error } = await auth.db.from("signals").insert(
        signals.map((s) => ({ industry_id: id, job: s.job, driver: s.driver, description: s.description, strength: s.strength, source_url: s.source_url ?? null, observed_on: s.observed_on, origin: parsed.data.mode === "web" ? "web" : "upload" })),
      );
      if (error) return fail(error.message, 500);
    }
    const note = parsed.data.mode === "web" && !llm.search ? "Web search is switched off (set ENABLE_WEB_SEARCH=true). Upload a document instead." : undefined;
    return NextResponse.json({ added: signals.length, unsourced: signals.filter((s) => !s.source_url).length, note });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Collecting signals failed", 502);
  }
}
