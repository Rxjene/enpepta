"use client";
import { useState } from "react";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth", { method: "POST", body: JSON.stringify({ mode, email: f.get("email"), password: f.get("password") }) });
    const j = await res.json();
    if (!res.ok) return setMsg(j.error);
    if (j.needsConfirm) return setMsg("Check your email to confirm your account, then sign in.");
    location.href = "/";
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded bg-white p-6 shadow">
      <h1 className="text-xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <label className="block text-sm">Email<input name="email" type="email" required className="mt-1 w-full rounded border p-2" /></label>
      <label className="block text-sm">Password (8+ characters)<input name="password" type="password" minLength={8} required className="mt-1 w-full rounded border p-2" /></label>
      <button className="w-full rounded bg-blue-700 p-2 text-white">{mode === "signin" ? "Sign in" : "Create account"}</button>
      <button type="button" className="text-sm text-blue-800 underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
      </button>
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </form>
  );
}
