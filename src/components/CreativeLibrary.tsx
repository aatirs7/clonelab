"use client";

import { useEffect, useState } from "react";

type Video = {
  video_id: string;
  video_title: string | null;
  belonged_creator_handle: string | null;
  revenue: number | null;
  views: number | null;
  ai_video: boolean | null;
  ad: boolean | null;
  ads_roas: number | null;
};

type CategoryCreative = {
  categoryId: string;
  categoryName: string;
  videos: Video[];
  aiCount: number;
  videoCount: number;
  fetchedAt: string;
};

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function ago(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Top-earning videos per category, from the cache the cron fills daily.
 *
 * The AI presenter count is the number this view exists for: if AI videos are already
 * earning in a category, that category is proven for CloneLab before a single frame is
 * filmed for it. Categories are ordered by that count for the same reason.
 */
export default function CreativeLibrary() {
  const [categories, setCategories] = useState<CategoryCreative[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("last7Day");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
    The previous window's data stays on screen while the next one loads, rather than being
    blanked first. That avoids a synchronous setState in the effect body and reads better:
    switching 7d to 30d no longer flashes an empty panel.
  */
  const [loadedRange, setLoadedRange] = useState<string | null>(null);
  const loading = loadedRange !== dateRange;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/creative?dateRange=${dateRange}`);
        const data = await response.json();
        if (cancelled) return;
        setCategories(data.categories ?? []);
        setLoadedRange(dateRange);
      } catch {
        if (!cancelled) setError("Could not read the creative cache.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  async function refresh(categoryId: string) {
    setRefreshing(categoryId);
    setError(null);
    const response = await fetch("/api/creative", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId, dateRange }),
    });
    if (!response.ok) {
      const d = await response.json().catch(() => null);
      setError(d?.error ?? "Refresh failed.");
      setRefreshing(null);
      return;
    }
    const fresh = await fetch(`/api/creative?dateRange=${dateRange}`).then((r) => r.json());
    setCategories(fresh.categories ?? []);
    setRefreshing(null);
  }

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Creative library</span>
        <div className="segmented">
          {["last7Day", "last30Day"].map((r) => (
            <button key={r} type="button" data-on={r === dateRange} onClick={() => setDateRange(r)}>
              {r === "last7Day" ? "7d" : "30d"}
            </button>
          ))}
        </div>
      </div>

      <p className="stat-sub" style={{ marginBottom: "1rem" }}>
        Top-earning videos by category, refreshed daily. Sorted by how many are AI-presenter
        videos, because that answers whether the format is already working there.
      </p>

      {error ? <p className="note note-rec">{error}</p> : null}

      {categories === null ? (
        <p className="stat-sub">{loading ? "Reading the cache." : "Nothing cached."}</p>
      ) : categories.length === 0 ? (
        <p className="note note-warn">
          Nothing cached for this window yet. The daily sweep fills it, or refresh a single
          category once it appears.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.375rem" }}>
          {categories.map((c) => {
            const isOpen = open === c.categoryId;
            return (
              <div key={c.categoryId} className="candidate">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : c.categoryId)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      color: "inherit",
                      font: "inherit",
                      cursor: "pointer",
                      minWidth: 0,
                    }}
                  >
                    <p style={{ fontSize: "0.875rem", fontWeight: 550 }}>{c.categoryName}</p>
                    <p className="tag">
                      {c.videoCount} videos · updated {ago(c.fetchedAt)}
                    </p>
                  </button>
                  <span className={c.aiCount > 0 ? "badge badge-strong" : "badge badge-partial"}>
                    {c.aiCount} AI
                  </span>
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => refresh(c.categoryId)}
                    disabled={refreshing !== null}
                  >
                    {refreshing === c.categoryId ? "..." : "refresh"}
                  </button>
                </div>

                {isOpen ? (
                  <div style={{ display: "grid", gap: "0.25rem", marginTop: "0.75rem" }}>
                    {c.videos.slice(0, 15).map((v) => (
                      <div key={v.video_id} className="videorow">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p className="candidate-name" style={{ fontSize: "0.8125rem" }}>
                            {v.video_title || "(no title)"}
                          </p>
                          <p className="tag">
                            ${compact(v.revenue)} · {compact(v.views)} views
                            {v.belonged_creator_handle ? ` · @${v.belonged_creator_handle}` : ""}
                            {v.ai_video ? " · AI presenter" : ""}
                            {v.ad ? ` · boosted${v.ads_roas ? ` ${v.ads_roas.toFixed(1)}x` : ""}` : ""}
                          </p>
                        </div>
                        <a
                          className="row-action"
                          href={`https://www.tiktok.com/@${v.belonged_creator_handle ?? "_"}/video/${v.video_id}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{ textDecoration: "none", flexShrink: 0 }}
                        >
                          watch
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
