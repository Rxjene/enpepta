import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api";
import { userClient } from "@/lib/supabase/server";

const body = z.object({ mode: z.enum(["signin", "signup"]), email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter a valid email and a password of at least 8 characters.");
  const db = await userClient();
  if (!db) return fail("The database is not configured yet.", 503);
  const { mode, email, password } = parsed.data;
  const { data, error } = mode === "signup" ? await db.auth.signUp({ email, password }) : await db.auth.signInWithPassword({ email, password });
  if (error) return fail(error.message, 400);
  const needsConfirm = mode === "signup" && !data.session;
  return NextResponse.json({ ok: true, needsConfirm });
}

export async function DELETE() {
  const db = await userClient();
  await db?.auth.signOut();
  return NextResponse.json({ ok: true });
}
