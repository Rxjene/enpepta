import { NextResponse } from "next/server";
import { z } from "zod";
import { mapIndustry } from "@/agent/industry-mapper";
import { createLlm } from "@/agent/llm";
import { fail, requireUser } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireUser(); // the model costs money, so only signed-in users
  if ("error" in auth) return auth.error;
  const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Please enter an industry name.");
  try {
    return NextResponse.json(await mapIndustry(parsed.data.name, createLlm()));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Mapping failed", 502);
  }
}
