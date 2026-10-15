import { NextResponse } from "next/server";
import { createLlm } from "@/agent/llm";
import { adminClient, userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Confirms that the database and the Anthropic API both respond. */
export async function GET() {
  const result = { database: { ok: false, detail: "" }, anthropic: { ok: false, detail: "" } };
  try {
    const db = adminClient() ?? (await userClient());
    if (!db) result.database.detail = "Supabase environment variables are missing.";
    else {
      const { error } = await db.from("cases").select("id", { head: true, count: "exact" }).limit(1);
      result.database = error ? { ok: false, detail: error.message } : { ok: true, detail: "reachable" };
    }
  } catch (e) {
    result.database.detail = e instanceof Error ? e.message : "unknown error";
  }
  try {
    const llm = createLlm();
    if (!llm) result.anthropic.detail = "ANTHROPIC_API_KEY is missing.";
    else {
      await llm.ping();
      result.anthropic = { ok: true, detail: "reachable" };
    }
  } catch (e) {
    result.anthropic.detail = e instanceof Error ? e.message : "unknown error";
  }
  const ok = result.database.ok && result.anthropic.ok;
  return NextResponse.json({ status: ok ? "OK" : "DEGRADED", ...result }, { status: ok ? 200 : 503 });
}
