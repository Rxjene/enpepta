"use client";
export function SignOut() {
  return (
    <button className="ml-2 text-blue-800 underline" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); location.href = "/"; }}>
      Sign out
    </button>
  );
}
