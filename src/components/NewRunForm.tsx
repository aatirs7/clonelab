"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AnglePicker from "./AnglePicker";
import ProductPicker from "./ProductPicker";

type Picked = { productId: number; name: string; kalodataProductId: string | null };

export default function NewRunForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"pick" | "manual">("pick");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [hookAngle, setHookAngle] = useState("");
  const [hasSample, setHasSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = picked !== null || productName.trim().length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        picked
          ? { productId: picked.productId, hookAngle }
          : { productName, productCategory, hookAngle, hasSample },
      ),
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
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="segmented" style={{ alignSelf: "start" }}>
        <button type="button" data-on={mode === "pick"} onClick={() => setMode("pick")}>
          From Kalodata
        </button>
        <button type="button" data-on={mode === "manual"} onClick={() => setMode("manual")}>
          By hand
        </button>
      </div>

      {mode === "pick" ? (
        picked ? (
          <div className="note note-ok">
            Using <strong>{picked.name}</strong>.{" "}
            <button
              type="button"
              className="row-action"
              onClick={() => setPicked(null)}
              style={{ marginLeft: "0.5rem" }}
            >
              change
            </button>
          </div>
        ) : (
          <ProductPicker
            onPicked={(productId, name, kalodataProductId) =>
              setPicked({ productId, name, kalodataProductId })
            }
          />
        )
      ) : null}

      <form onSubmit={submit} style={{ display: "grid", gap: "1rem" }}>
        {mode === "manual" ? (
          <div className="rows">
            <div className="row">
              <span className="row-key">Product</span>
              <input
                className="row-value"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Red branded work cap"
              />
              <span />
            </div>
            <div className="row">
              <span className="row-key">Category</span>
              <input
                className="row-value"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="Workwear"
              />
              <span />
            </div>
            {/* Sample is a fact about the product, so it is stored on the product record. */}
            <div className="row">
              <span className="row-key">Sample</span>
              <button
                type="button"
                className="row-value"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  color: hasSample ? "var(--ok)" : "var(--ink-faint)",
                }}
                onClick={() => setHasSample((v) => !v)}
              >
                {hasSample ? "on hand" : "not on hand"}
              </button>
              <span />
            </div>
          </div>
        ) : null}

        <AnglePicker
          value={hookAngle}
          onChange={setHookAngle}
          kalodataProductId={picked?.kalodataProductId ?? null}
        />

        {error ? <p className="note note-rec">{error}</p> : null}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
            {busy ? "Starting" : "Start run"}
          </button>
        </div>
      </form>
    </div>
  );
}
