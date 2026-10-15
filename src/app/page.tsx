import { HomeClient } from "@/components/HomeClient";
import { currentUser, supabaseConfigured } from "@/lib/supabase/server";

export default async function Home() {
  const configured = supabaseConfigured();
  const { db, user } = await currentUser();
  let existing: { id: string; name: string; jobs: { name: string; description: string }[]; forecastId: string | null }[] = [];
  if (db && user) {
    const { data } = await db.from("industries").select("id, name, jobs(name, description, position), forecasts(id, created_at)").eq("owner_id", user.id).order("created_at", { ascending: false });
    existing = (data ?? []).map((i) => ({
      id: i.id, name: i.name,
      jobs: [...(i.jobs as { name: string; description: string; position: number }[])].sort((a, b) => a.position - b.position),
      forecastId: ([...(i.forecasts as { id: string; created_at: string }[])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.id) ?? null,
    }));
  }
  return <HomeClient configured={configured} signedIn={Boolean(user)} existing={existing} />;
}
