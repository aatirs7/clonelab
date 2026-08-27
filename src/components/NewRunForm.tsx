"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewRunForm() {
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [hookAngle, setHookAngle] = useState("");
  const [hasSample, setHasSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productName, productCategory, hookAngle, hasSample }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Could not start the run.");
      setBusy(false);
      return;
    }

    router.push(`/runs/${data.id}`);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "1rem" }}>
      <div className="rows">
        <div className="row">
          <span className="row-key">Product</span>
          <input
            className="row-value"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="Red branded work cap"
            autoFocus
            required
          />
          <span />
        </div>
        <div className="row">
          <span className="row-key">Category</span>
          <input
            className="row-value"
            value={productCategory}
            onChange={(event) => setProductCategory(event.target.value)}
            placeholder="Workwear"
          />
          <span />
        </div>
        <div className="row">
          <span className="row-key">Angle</span>
          <input
            className="row-value"
            value={hookAngle}
            onChange={(event) => setHookAngle(event.target.value)}
            placeholder="You are using this wrong"
          />
          <span />
        </div>
        <div className="row">
          <span className="row-key">Sample</span>
          <button
            type="button"
            className="row-value"
            style={{ textAlign: "left", cursor: "pointer", color: hasSample ? "var(--ok)" : "var(--ink-faint)" }}
            onClick={() => setHasSample((current) => !current)}
          >
            {hasSample ? "on hand" : "not on hand"}
          </button>
          <span />
        </div>
      </div>

      {error ? <p className="note note-rec">{error}</p> : null}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy || !productName}>
          {busy ? "Starting" : "Start run"}
        </button>
      </div>
    </form>
  );
}
