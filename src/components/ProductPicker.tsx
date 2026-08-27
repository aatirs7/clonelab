"use client";

import { useState } from "react";
import type { ScoreComponent } from "@/db/schema";

/*
  The picker feeds the Start-a-run form rather than becoming a step in the rail. The rail
  is a fixed linear 01-08 chain, so inserting research at the front would renumber every
  step and push every existing run one lock deeper.
*/

type Split = { live: number; video: number; showcase: number } | null;

type Score = {
  profile: string;
  total: number;
  max: number;
  band: string;
  tone: "strong" | "test" | "marginal" | "pass";
  components: ScoreComponent[];
};

export type Candidate = {
  productId: string;
  name: string;
  imageUrl: string | null;
  sellerName: string | null;
  revenue: number | null;
  commissionRate: number | null;
  unitPrice: number | null;
  salesVolumn: number | null;
  revenueGrowthRate: number | null;
  launchDate: string | null;
  liveRevenue: number | null;
  videoRevenue: number | null;
  showcaseRevenue: number | null;
  formatSplit: Split;
  partialScore: number;
  partialComponents: ScoreComponent[];
  score: Score | null;
};

function usd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** Revenue by surface. Shown on every candidate, never used to gate anything. */
function FormatSplit({ split }: { split: Split }) {
  if (!split) return null;
  const parts = [
    { key: "live", pct: split.live, color: "var(--series-earned)" },
    { key: "video", pct: split.video, color: "var(--series-spend)" },
    { key: "showcase", pct: split.showcase, color: "var(--ink-faint)" },
  ];
  return (
    <div>
      <div className="split-bar">
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${p.pct}%`, background: p.color }} />
        ))}
      </div>
      <p className="tag" style={{ marginTop: "0.3125rem" }}>
        live {split.live.toFixed(0)}% · video {split.video.toFixed(0)}% · showcase{" "}
        {split.showcase.toFixed(0)}%
      </p>
    </div>
  );
}

function Components({ components }: { components: ScoreComponent[] }) {
  return (
    <div className="rows" style={{ marginTop: "0.75rem" }}>
      {components.map((c) => (
        <div className="row" key={c.key} style={{ gridTemplateColumns: "9rem 1fr auto" }}>
          <span className="row-key">{c.label}</span>
          <span className="stat-sub" style={{ marginTop: 0 }}>
            {c.reason}
          </span>
          <span
            className="mono"
            style={{ color: c.points === 0 ? "var(--rec)" : c.points === c.max ? "var(--ok)" : "var(--ink)" }}
          >
            {c.points}/{c.max}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProductPicker({
  onPicked,
}: {
  onPicked: (productId: number, name: string, kalodataProductId: string) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [dateRange, setDateRange] = useState("last7Day");
  const [busy, setBusy] = useState(false);
  const [scoring, setScoring] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sweep() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/picker/sweep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dateRange,
        ...(categoryId ? { categoryIds: [categoryId] } : {}),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "The sweep failed.");
      setBusy(false);
      return;
    }
    setCandidates(data.candidates);
    setCategories(data.categories ?? []);
    setBusy(false);
  }

  async function score(candidate: Candidate) {
    setScoring(candidate.productId);
    setError(null);
    const response = await fetch("/api/picker/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidate }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Scoring failed.");
      setScoring(null);
      return;
    }
    setCandidates((current) =>
      (current ?? []).map((c) => (c.productId === candidate.productId ? data.candidate : c)),
    );
    setOpen(candidate.productId);
    setScoring(null);
  }

  async function pick(candidate: Candidate) {
    setPicking(candidate.productId);
    const response = await fetch("/api/picker/pick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidate, dateRange }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Could not save the product.");
      setPicking(null);
      return;
    }
    onPicked(data.productId, candidate.name, candidate.productId);
    setPicking(null);
  }

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Find a product</span>
        <span className="tag">Kalodata · affiliate · commission 15%+</span>
      </div>

      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        <select className="field" style={{ width: "auto" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="segmented">
          {["last7Day", "last30Day"].map((r) => (
            <button key={r} type="button" data-on={r === dateRange} onClick={() => setDateRange(r)}>
              {r === "last7Day" ? "7d" : "30d"}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={sweep} disabled={busy}>
          {busy ? "Sweeping" : candidates ? "Sweep again" : "Sweep"}
        </button>
      </div>

      {error ? <p className="note note-rec">{error}</p> : null}

      {candidates === null ? (
        <p className="stat-sub">
          One rank call returns the top 100 affiliate products and scores commission economics on
          all of them. Scoring the rest of the rubric costs three more calls per product, so that
          runs only on the ones you ask for.
        </p>
      ) : candidates.length === 0 ? (
        <p className="stat-sub">Nothing came back for those filters.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.375rem" }}>
          {candidates.slice(0, 25).map((c) => {
            const isOpen = open === c.productId;
            const total = c.score?.total ?? c.partialScore;
            const shown = c.score ? `${total}/100` : `${total}/20`;
            return (
              <div key={c.productId} className="candidate">
                <div className="candidate-head">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="candidate-img" />
                  ) : (
                    <div className="candidate-img" />
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="candidate-name">{c.name}</p>
                    <p className="tag">
                      {usd(c.revenue)} rev · {c.commissionRate ?? "-"}% comm · {usd(c.unitPrice)} ·{" "}
                      {c.salesVolumn?.toLocaleString() ?? "-"} sold
                      {c.revenueGrowthRate !== null
                        ? ` · ${c.revenueGrowthRate > 0 ? "+" : ""}${c.revenueGrowthRate.toFixed(0)}% growth`
                        : ""}
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span className={`badge badge-${c.score?.tone ?? "partial"}`}>{shown}</span>
                    <br />
                    <span className="tag">{c.score?.band ?? "commission only"}</span>
                  </div>
                </div>

                <FormatSplit split={c.formatSplit} />

                {isOpen ? <Components components={c.score?.components ?? c.partialComponents} /> : null}

                <div className="btn-row" style={{ marginTop: "0.75rem" }}>
                  {c.score ? (
                    <button type="button" className="btn btn-quiet" onClick={() => setOpen(isOpen ? null : c.productId)}>
                      {isOpen ? "Hide breakdown" : "Show breakdown"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => score(c)}
                      disabled={scoring !== null}
                    >
                      {scoring === c.productId ? "Scoring" : "Score fully (3 calls)"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => pick(c)}
                    disabled={picking !== null}
                  >
                    {picking === c.productId ? "Saving" : "Use this product"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
