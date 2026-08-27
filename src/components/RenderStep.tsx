"use client";

import { useEffect, useState } from "react";
import type { Run } from "@/db/schema";
import { estimateCents, formatCents, type Resolution } from "@/lib/cost";

const RESOLUTIONS: Resolution[] = ["480p", "720p"];

function elapsedLabel(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function RenderStep({ run, onChanged }: { run: Run; onChanged: () => void }) {
  const [resolution, setResolution] = useState<Resolution>(run.resolution);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  /*
    Counted from when the render was submitted, not from when this component mounted.
    updatedAt is stamped at submission and not touched again until the render reaches a
    terminal state, so a refresh part way through a five minute render still shows the
    real elapsed time instead of restarting the clock at zero, which is precisely the
    situation this waiting state exists for.
  */
  const startedAt = new Date(run.updatedAt).getTime();
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  const rendering = run.status === "rendering" || run.status === "queued";
  const inputSeconds = run.sourceClipSeconds ?? 0;

  const estimate = estimateCents({ resolution, seconds: run.seconds, inputSeconds, hasVideoReference: true });
  const cheap = estimateCents({
    resolution: "480p",
    seconds: run.seconds,
    inputSeconds,
    hasVideoReference: true,
  });

  // Poll while a render is in flight. The status route writes the terminal result back to
  // the run, so this is a display concern only and closing the tab loses nothing.
  useEffect(() => {
    if (!rendering) return;

    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    const poll = setInterval(async () => {
      const response = await fetch(`/api/runs/${run.id}/status`);
      const data = await response.json().catch(() => null);
      if (!data) return;
      setQueuePosition(data.queuePosition ?? null);
      if (data.status === "complete" || data.status === "failed") onChanged();
    }, 5000);

    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [rendering, run.id, startedAt, onChanged]);

  async function chooseResolution(next: Resolution) {
    setResolution(next);
    await fetch(`/api/runs/${run.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution: next }),
    });
    onChanged();
  }

  async function render() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/runs/${run.id}/render`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "The render could not be submitted.");
      setBusy(false);
      return;
    }
    onChanged();
    setBusy(false);
  }

  if (rendering) {
    return (
      <>
        <div className="figure" style={{ color: "var(--rec)" }}>{elapsedLabel(elapsed)}</div>
        <p className="tag">
          {queuePosition !== null ? `position ${queuePosition} in queue · ` : ""}
          {formatCents(run.estimatedCost)} committed
        </p>
        <p className="note note-rec">
          Reference renders with a video input are the slowest Seedance endpoint, so this takes
          several minutes. Close the tab if you want, the run picks up where it left off.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="segmented">
        {RESOLUTIONS.map((option) => (
          <button key={option} type="button" data-on={option === resolution} onClick={() => chooseResolution(option)}>
            {option}
          </button>
        ))}
      </div>

      <div>
        <div className="figure">{formatCents(estimate)}</div>
        <p className="tag" style={{ marginTop: "0.5rem" }}>
          {run.seconds}s out + {inputSeconds.toFixed(1)}s in, both billed
        </p>
      </div>

      <p className="note note-warn">
        An estimate from the published formula, not a quote. What fal actually bills is recorded on
        the run so this gets calibrated after the first real render.
      </p>

      {resolution === "720p" ? (
        <p className="note note-rec">
          Roughly {(estimate / Math.max(1, cheap)).toFixed(1)}x what 480p costs. Worth it on a take
          you already like, not on a first attempt.
        </p>
      ) : null}

      {error ? <p className="note note-rec">{error}</p> : null}

      <div className="btn-row">
        <button type="button" className="btn btn-rec" onClick={render} disabled={busy}>
          {busy ? "Submitting" : `Render ${resolution} · ${formatCents(estimate)}`}
        </button>
      </div>
    </>
  );
}
