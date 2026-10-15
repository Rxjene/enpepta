import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/** Service-role client: bypasses row-level security. Server only; use for seeded tables and backtests. */
export function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/** Client acting as the signed-in user, so row-level security applies. */
export async function userClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try { all.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a server component */ }
      },
    },
  });
}

export async function currentUser() {
  const db = await userClient();
  if (!db) return { db: null, user: null };
  const { data } = await db.auth.getUser();
  return { db, user: data.user };
}
