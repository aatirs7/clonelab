"use client";

import { useState } from "react";

/**
 * The angle, from two sources on one panel.
 *
 * Kalodata has no angle field, but it has the videos already winning on a product, and a
 * title that earned is a proven angle for that exact product. When the live data is thin
 * or the product was not picked through Kalodata, the curated archetypes below are the
 * fallback. Either way the field stays editable: the angle is a creative call.
 */

const ARCHETYPES = [
  "You are using this wrong",
  "Nobody talks about this",
  "I was skeptical until",
  "The thing nobody reads on the label",
  "Three mistakes everyone makes",
  "Why this costs what it costs",
  "What happens if you skip this",
  "The version I wish I bought first",
  "How to tell if yours is fake",
  "What the reviews do not mention",
  "The one setting that changes everything",
  "I tested this for thirty days",
  "Stop doing this to yours",
  "The part that fails first",
  "What professionals actually use",
];

type Video = {
  video_id: string;
  video_title: string | null;
  belonged_creator_handle: string | null;
  revenue: number | null;
  views: number | null;
  ai_video: boolean | null;
  ad: boolean | null;
};

function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export default function AnglePicker({
  value,
  onChange,
  kalodataProductId,
}: {
  value: string;
  onChange: (angle: string) => void;
  kalodataProductId: string | null;
}) {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"proven" | "archetypes">("proven");

  async function loadProven() {
    if (!kalodataProductId) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/picker/angles?productId=${encodeURIComponent(kalodataProductId)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Could not load the winning videos.");
      setBusy(false);
      return;
    }
    setVideos(data.videos ?? []);
    setBusy(false);
  }

  const aiWinning = (videos ?? []).filter((v) => v.ai_video).length;

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Angle</span>
        <div className="segmented">
          <button
            type="button"
            data-on={source === "proven"}
            onClick={() => {
              setSource("proven");
              if (videos === null) loadProven();
            }}
            disabled={!kalodataProductId}
            title={kalodataProductId ? undefined : "Pick a product from Kalodata to see proven angles"}
          >
            Proven
          </button>
          <button type="button" data-on={source === "archetypes"} onClick={() => setSource("archetypes")}>
            Archetypes
          </button>
        </div>
      </div>

      <div className="rows" style={{ marginBottom: "0.75rem" }}>
        <div className="row">
          <span className="row-key">Angle</span>
          <input
            className="row-value"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="You are using this wrong"
          />
          <span />
        </div>
      </div>

      {source === "archetypes" ? (
        <div className="chips">
          {ARCHETYPES.map((a) => (
            <button
              key={a}
              type="button"
              className="chip"
              data-on={value === a}
              onClick={() => onChange(a)}
            >
              {a}
            </button>
          ))}
        </div>
      ) : !kalodataProductId ? (
        <p className="stat-sub">
          Proven angles come from the videos already earning on this exact product, so they need a
          product picked from Kalodata. Use the archetypes otherwise.
        </p>
      ) : busy ? (
        <p className="stat-sub">Loading the videos already earning on this product.</p>
      ) : error ? (
        <p className="note note-rec">{error}</p>
      ) : videos === null ? (
        <button type="button" className="btn" onClick={loadProven}>
          Load winning videos
        </button>
      ) : videos.length === 0 ? (
        <p className="stat-sub">
          No videos came back for this product in the last 7 days. The archetypes are the fallback.
        </p>
      ) : (
        <>
          {/*
            The one number here that decides whether to film at all: if AI presenters are
            already earning on this product, the format is proven for it.
          */}
          <p className={aiWinning > 0 ? "note note-ok" : "note note-warn"} style={{ marginBottom: "0.75rem" }}>
            {aiWinning > 0
              ? `${aiWinning} of the top ${videos.length} earning videos are AI-presenter videos. The format is already working here.`
              : `None of the top ${videos.length} earning videos are AI-presenter videos. Either an opening or a warning, depending on why.`}
          </p>

          <div style={{ display: "grid", gap: "0.375rem" }}>
            {videos.slice(0, 12).map((v) => (
              <div key={v.video_id} className="candidate" style={{ padding: "0.625rem 0.75rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="candidate-name" style={{ fontSize: "0.8125rem" }}>
                      {v.video_title || "(no title)"}
                    </p>
                    <p className="tag">
                      ${compact(v.revenue)} · {compact(v.views)} views
                      {v.belonged_creator_handle ? ` · @${v.belonged_creator_handle}` : ""}
                      {v.ai_video ? " · AI presenter" : ""}
                      {v.ad ? " · boosted" : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                    <a
                      className="row-action"
                      href={`https://www.tiktok.com/@${v.belonged_creator_handle ?? "_"}/video/${v.video_id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ textDecoration: "none" }}
                    >
                      watch
                    </a>
                    <button
                      type="button"
                      className="row-action"
                      onClick={() => onChange(v.video_title ?? "")}
                      disabled={!v.video_title}
                    >
                      use
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
