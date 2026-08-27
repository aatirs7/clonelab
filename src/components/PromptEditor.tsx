"use client";

import { useState } from "react";

export default function PromptEditor({
  runId,
  prompt,
  edited,
  onChanged,
}: {
  runId: number;
  prompt: string;
  edited: boolean;
  onChanged: (prompt: string, edited: boolean) => void;
}) {
  const [draft, setDraft] = useState(prompt);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(next: string, nextEdited: boolean) {
    setBusy(true);
    await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: next, promptEdited: nextEdited }),
    });
    onChanged(next, nextEdited);
    setBusy(false);
    setEditing(false);
  }

  if (!prompt) {
    return (
      <p className="panel-hint" style={{ marginTop: 0 }}>
        Cast the character and write the beat sheet, and this composes itself.
      </p>
    );
  }

  return (
    <>
      {editing ? (
        <textarea
          className="field"
          value={draft}
          rows={16}
          onChange={(event) => setDraft(event.target.value)}
          style={{ fontSize: "0.875rem", lineHeight: 1.65, resize: "vertical" }}
        />
      ) : (
        <div className="readout">{prompt}</div>
      )}

      <div className="btn-row">
        {editing ? (
          <button type="button" className="btn btn-primary" onClick={() => save(draft, true)} disabled={busy}>
            {busy ? "Saving" : "Save prompt"}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(prompt);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
        {/* Clearing the stored text is what lets it recompose from the fields again. */}
        {edited ? (
          <button type="button" className="btn btn-quiet" onClick={() => save("", false)} disabled={busy}>
            Reset to generated
          </button>
        ) : null}
      </div>
    </>
  );
}
