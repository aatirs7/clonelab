"use client";

import { useEffect, useState } from "react";

type Profile = {
  shopId: string;
  shopName?: string | null;
  revenue?: number | null;
  videoCount: number;
  adVideoCount: number;
  adShare: number;
  medianAdsRoas: number | null;
  meanAdRevenueRatio: number | null;
  meanAdViewRatio: number | null;
};

type Snapshot = { day: string; adShare: number; videoCount: number; adVideoCount: number };

function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "-" : `${n.toFixed(0)}%`;
}

/** A brand's ad_share over time. The shape is the signal, not any single reading. */
function Sparkline({ points }: { points: Snapshot[] }) {
  if (points.length < 2) {
    return <span className="tag">one reading so far, the series starts building tomorrow</span>;
  }
  const W = 120;
  const H = 28;
  const xs = (i: number) => (i / (points.length - 1)) * W;
  const ys = (v: number) => H - (v / 100) * H;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(p.adShare)}`).join(" ");
  const first = points[0].adShare;
  const last = points[points.length - 1].adShare;
  const rising = last > first;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <svg width={W} height={H} role="img" aria-label={`Ad share over ${points.length} days`}>
        <path d={d} fill="none" stroke={rising ? "var(--ok)" : "var(--rec)"} strokeWidth="1.5" />
      </svg>
      <span className="tag" style={{ color: rising ? "var(--ok)" : "var(--rec)" }}>
        {rising ? "+" : ""}
        {(last - first).toFixed(0)} pts over {points.length}d
      </span>
    </span>
  );
}

/**
 * Which brands are paying to boost their affiliates.
 *
 * ad_share is the headline: the proportion of a brand's earning videos carrying the ad
 * flag. A brand boosting nearly everything gives its affiliates reach they did not pay
 * for, which matters more than any single product's numbers.
 */
export default function AdSpendDetector() {
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [watched, setWatched] = useState<{ shopId: string; shopName: string | null }[]>([]);
  const [history, setHistory] = useState<Record<string, Snapshot[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWatched() {
    const d = await fetch("/api/adspend").then((r) => r.json());
    setWatched(d.shops ?? []);
    const map: Record<string, Snapshot[]> = {};
    for (const h of d.history ?? []) map[h.shopId] = h.points;
    setHistory(map);
  }

  useEffect(() => {
    // Wrapped so the state write happens after an await rather than synchronously in the
    // effect body, which would cascade a render before the first paint.
    (async () => {
      try {
        await loadWatched();
      } catch {
        setError("Could not read the watch list.");
      }
    })();
  }, []);

  async function leaderboard() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/adspend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "leaderboard", limit: 8 }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Could not build the leaderboard.");
      setBusy(false);
      return;
    }
    setRows(data.rows ?? []);
    setBusy(false);
  }

  async function toggleWatch(shopId: string, shopName: string | null, on: boolean) {
    await fetch("/api/adspend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: on ? "watch" : "unwatch", shopId, shopName }),
    });
    await loadWatched();
  }

  const isWatched = (id: string) => watched.some((w) => w.shopId === id);

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Ad spend detector</span>
        <button type="button" className="btn" onClick={leaderboard} disabled={busy}>
          {busy ? "Reading brands" : rows ? "Rebuild" : "Build leaderboard"}
        </button>
      </div>

      <p className="stat-sub" style={{ marginBottom: "1rem" }}>
        What share of each brand&apos;s earning videos carry the ad flag. A brand boosting nearly
        everything gives its affiliates reach they did not pay for. Nine calls, roughly nine cents.
      </p>

      {error ? <p className="note note-rec">{error}</p> : null}

      {watched.length > 0 ? (
        <>
          <p className="eyebrow" style={{ marginTop: "0.5rem" }}>
            Watching ({watched.length})
          </p>
          <div style={{ display: "grid", gap: "0.375rem", marginBottom: "1.25rem" }}>
            {watched.map((w) => (
              <div key={w.shopId} className="videorow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 550 }}>{w.shopName ?? w.shopId}</p>
                  <Sparkline points={history[w.shopId] ?? []} />
                </div>
                <button
                  type="button"
                  className="row-action"
                  onClick={() => toggleWatch(w.shopId, w.shopName, false)}
                >
                  unwatch
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {rows === null ? null : rows.length === 0 ? (
        <p className="stat-sub">No brands came back.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.375rem" }}>
          {rows.map((r) => (
            <div key={r.shopId} className="candidate">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 550 }}>{r.shopName ?? r.shopId}</p>
                  <p className="tag">
                    {r.adVideoCount}/{r.videoCount} videos boosted
                    {r.medianAdsRoas ? ` · median ROAS ${r.medianAdsRoas.toFixed(1)}x` : ""}
                    {r.meanAdRevenueRatio !== null
                      ? ` · ${pct(r.meanAdRevenueRatio * 100)} of revenue from ads`
                      : ""}
                  </p>
                </div>
                <span
                  className={
                    r.adShare >= 50 ? "badge badge-strong" : r.adShare >= 20 ? "badge badge-test" : "badge badge-partial"
                  }
                >
                  {pct(r.adShare)}
                </span>
                <button
                  type="button"
                  className="row-action"
                  onClick={() => toggleWatch(r.shopId, r.shopName ?? null, !isWatched(r.shopId))}
                  style={isWatched(r.shopId) ? { color: "var(--ok)", borderColor: "var(--ok)" } : undefined}
                >
                  {isWatched(r.shopId) ? "watching" : "watch"}
                </button>
              </div>

              {/* The ad share bar, so the leaderboard is scannable without reading numbers. */}
              <div className="prompter-bar" style={{ marginTop: "0.625rem", height: 3 }}>
                <div
                  className="prompter-bar-fill"
                  style={{
                    width: `${r.adShare}%`,
                    background: r.adShare >= 50 ? "var(--ok)" : "var(--accent)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
