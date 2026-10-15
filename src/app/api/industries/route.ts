import { NextResponse } from "next/server";
import { z } from "zod";
import { validateJobs } from "@/agent/industry-mapper";
import { fail, requireUser } from "@/lib/api";

const body = z.object({
  name: z.string().min(1).max(80),
  jobs: z.array(z.object({ name: z.string().min(2).max(60), description: z.string().max(240).optional() })),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.db.from("industries").select("id, name, is_seed, created_at, jobs(name, description, position)").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ industries: data });
}

/** Saves an industry and its (possibly human-edited) jobs. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Industry name and jobs are required.");
  const problems = validateJobs(parsed.data.jobs);
  if (problems.length) return fail(problems.join(" "));
  const { data: ind, error } = await auth.db.from("industries").insert({ name: parsed.data.name.trim(), owner_id: auth.user.id }).select("id").single();
  if (error) return fail(error.message, 500);
  const { error: jobErr } = await auth.db.from("jobs").insert(parsed.data.jobs.map((j, i) => ({ industry_id: ind.id, name: j.name.trim(), description: j.description ?? null, position: i })));
  if (jobErr) return fail(jobErr.message, 500);
  return NextResponse.json({ id: ind.id });
}
