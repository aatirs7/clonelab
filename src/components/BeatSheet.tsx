"use client";

import { useState } from "react";
import type { Beat, Run } from "@/db/schema";

function tc(value: number): string {
  return value.toFixed(1).padStart(4, "0");
}

export default function BeatSheet({ run, onSaved }: { run: Run; onSaved: (beats: Beat[]) => void }) {
  const [beats, setBeats] = useState<Beat[]>(run.beats ?? []);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const total = beats.reduce((sum, beat) => sum + beat.duration, 0);

  async function send(payload: object) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/runs/${run.id}/beats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "That did not work.");
      setBusy(false);
      return;
    }
    setBeats(data.beats);
    setIssues(data.issues ?? []);
    onSaved(data.beats);
    setBusy(false);
  }

  /**
   * Changing a duration rewrites every following start time, because beats are contiguous
   * by definition. If they were not, the teleprompter and the render prompt would be
   * describing two different videos.
   */
  function editDuration(index: number, duration: number) {
    setBeats((current) => {
      const next = current.map((beat, i) => (i === index ? { ...beat, duration } : { ...beat }));
      let at = 0;
      for (const beat of next) {
        beat.at = at;
        at += beat.duration;
      }
      return next;
    });
  }

  function editField(index: number, key: "action" | "line", value: string) {
    setBeats((current) =>
      current.map((beat, i) =>
        i === index ? { ...beat, [key]: key === "line" && !value ? null : value } : beat,
      ),
    );
  }

  if (beats.length === 0) {
    return (
      <>
        {error ? <p className="note note-rec">{error}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => send({ action: "generate" })} disabled={busy}>
            {busy ? "Writing" : "Write the beat sheet"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="rows">
        {beats.map((beat, index) => (
          <div className="beat" key={index}>
            <span className="beat-time">
              {tc(beat.at)}
              <br />
              <span style={{ color: "var(--ink-faint)" }}>+{beat.duration.toFixed(1)}</span>
            </span>
            <div>
              {editing ? (
                <>
                  <input
                    className="row-value"
                    value={beat.action}
                    onChange={(event) => editField(index, "action", event.target.value)}
                  />
                  <input
                    className="row-value"
                    value={beat.line ?? ""}
                    placeholder="silent beat"
                    onChange={(event) => editField(index, "line", event.target.value)}
                    style={{ color: "var(--ink-dim)" }}
                  />
                  <input
                    className="row-value mono"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={beat.duration}
                    onChange={(event) => editDuration(index, Number(event.target.value) || 0.5)}
                    style={{ width: "5rem", fontSize: "0.75rem" }}
                  />
                </>
              ) : (
                <>
                  <div className="beat-action">{beat.action}</div>
                  <div className="beat-line">{beat.line ? `"${beat.line}"` : "silent"}</div>
                </>
              )}
            </div>
          </div>
        ))}
        <div className="beat-total">Total {total.toFixed(1)}s</div>
      </div>

      {/*
        Reported, not enforced. A sheet that bends a rule is still a usable plan and the
        operator is the one who decides whether it is worth a reroll.
      */}
      {issues.length > 0 ? (
        <div className="note note-warn">
          {issues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </div>
      ) : null}

      {error ? <p className="note note-rec">{error}</p> : null}

      <div className="btn-row">
        {editing ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await send({ action: "save", beats });
              setEditing(false);
            }}
            disabled={busy}
          >
            {busy ? "Saving" : "Save beats"}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={() => send({ action: "generate" })} disabled={busy}>
          {busy ? "Working" : "Rewrite"}
        </button>
      </div>
    </>
  );
}
