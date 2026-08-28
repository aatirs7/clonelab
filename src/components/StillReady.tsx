"use client";

import { useState } from "react";
import type { Product } from "@/db/schema";

/**
 * Previews the still without hosting it.
 *
 * The still goes from ChatGPT straight to Higgsfield off the operator's disk, so uploading
 * it here only added waiting. What the step is actually for is the comparison: checking
 * that the product in the generated still is the product that went in. That works fine
 * against a local object URL.
 *
 * Marking it ready is an explicit acknowledgement rather than an inferred one, because
 * nothing in the app can see a file on someone else's desktop.
 */
export default function StillReady({
  runId,
  product,
  productPhoto,
  ready,
  onReady,
}: {
  runId: number;
  product: Product;
  productPhoto: string | null;
  ready: boolean;
  onReady: (ready: boolean) => void;
}) {
  const [local, setLocal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function mark(next: boolean) {
    setBusy(true);
    await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next ? "still_ready" : "filmed" }),
    });
    onReady(next);
    setBusy(false);
  }

  return (
    <div className="rows">
      <div className="row" style={{ gridTemplateColumns: "1fr" }}>
        <p className="stat-sub" style={{ marginTop: 0, textAlign: "left" }}>
          Drop the still ChatGPT gave you in here to check it against the product before you commit
          to a render. It is not uploaded anywhere, it just gets shown side by side.
        </p>
      </div>

      <div className="row" style={{ gridTemplateColumns: "1fr" }}>
        <input
          type="file"
          accept="image/*"
          className="field"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setLocal(URL.createObjectURL(file));
          }}
        />
      </div>

      {local ? (
        <div className="row" style={{ gridTemplateColumns: "1fr" }}>
          <div className="compare">
            {productPhoto ? (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productPhoto} alt="The real product" className="thumb" />
                <figcaption className="tag">{product.name.slice(0, 34)}</figcaption>
              </figure>
            ) : null}
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={local} alt="Generated still" className="thumb" />
              <figcaption className="tag">what came back</figcaption>
            </figure>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ gridTemplateColumns: "1fr" }}>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button
            type="button"
            className={ready ? "btn" : "btn btn-primary"}
            onClick={() => mark(!ready)}
            disabled={busy}
          >
            {busy ? "Saving" : ready ? "Still marked ready" : "The still is ready"}
          </button>
        </div>
      </div>
    </div>
  );
}
