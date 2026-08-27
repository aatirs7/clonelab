"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.replace("/");
      router.refresh();
      return;
    }

    const body = await response.json().catch(() => null);
    setError(body?.error ?? "That did not work.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          autoComplete="current-password"
        />
      </div>
      {error ? <p className="note note-rec">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={busy || !password}>
        {busy ? "Checking" : "Sign in"}
      </button>
    </form>
  );
}
