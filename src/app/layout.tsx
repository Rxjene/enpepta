import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/supabase/server";
import { SignOut } from "@/components/SignOut";

export const metadata: Metadata = { title: "Disruption Forecast Agent", description: "Odds, with reasons, for the next disruption in industries that serve the public." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user } = await currentUser().catch(() => ({ user: null }));
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 p-4 text-sm">
            <Link href="/" className="font-semibold">Disruption Forecast</Link>
            <Link href="/cases" className="text-blue-800 hover:underline">Case library</Link>
            <Link href="/backtest" className="text-blue-800 hover:underline">Backtests</Link>
            <span className="ml-auto">{user ? <>{user.email} <SignOut /></> : <Link href="/login" className="text-blue-800 hover:underline">Sign in</Link>}</span>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
        <footer className="mx-auto max-w-5xl p-4 text-xs text-slate-600">
          These are odds with reasons, not predictions of certainty. Only public information about industries is used; never enter personal or health information.
        </footer>
      </body>
    </html>
  );
}
