import { NextResponse } from "next/server";
import { currentUser } from "./supabase/server";

export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Signed-in user and a database client that obeys row-level security, or an error response. */
export async function requireUser() {
  const { db, user } = await currentUser();
  if (!db) return { error: fail("The database is not configured yet (SUPABASE_URL / SUPABASE_ANON_KEY missing).", 503) } as const;
  if (!user) return { error: fail("Please sign in first.", 401) } as const;
  return { db, user } as const;
}
