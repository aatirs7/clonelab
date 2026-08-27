"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * There was no way to end a session from the UI at all. Combined with a very long lived
 * cookie that meant a signed-in browser profile never saw the password prompt again,
 * which reads exactly like the app having no auth on it.
 */
export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="rail-item"
      style={{ width: "100%" }}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/login", { method: "DELETE" });
        router.replace("/login");
        router.refresh();
      }}
    >
      <span className="rail-num">⏻</span>
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
