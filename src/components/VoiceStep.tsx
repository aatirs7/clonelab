"use client";

import { useRef, useState } from "react";
import type { RunWithProduct } from "@/lib/runs";

/**
 * Converts the take's audio into the character's voice.
 *
 * This sits after the render because it needs nothing from it: the conversion runs on the
 * original recording, not on the rendered video. Keeping them separate is also what keeps
 * the sync exact, since the converted track is the same length as the take that drove the
 * lip motion.
 */
export default function VoiceStep({
  run,
  onConverted,
}: {
  run: RunWithProduct;
  onConverted: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voiceName = run.character?.voiceName ?? null;

  async function convert(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("audio", file);

    const response = await fetch(`/api/runs/${run.id}/voice`, { method: "POST", body: form });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "The conversion failed.");
      setBusy(false);
      return;
    }
    onConverted(data.url);
    setBusy(false);
  }

  if (!voiceName) {
    return (
      <p className="note note-warn">
        No voice chosen for this character, so the take keeps your own. Pick one on the casting step
        if you want it converted.
      </p>
    );
  }

  return (
    <>
      <p className="stat-sub">
        Upload the audio from your take. It comes back as {voiceName} with your timing and delivery
        intact, so it drops onto the render one to one.
      </p>

      <input
        ref={input}
        type="file"
        accept="audio/*,video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) convert(file);
          e.target.value = "";
        }}
      />

      {error ? <p className="note note-rec">{error}</p> : null}

      {run.voicedAudioUrl ? (
        <div className="rows">
          <div className="row" style={{ gridTemplateColumns: "7.5rem 1fr" }}>
            <span className="row-key">Converted</span>
            <audio src={run.voicedAudioUrl} controls style={{ width: "100%", maxWidth: "20rem" }} />
          </div>
        </div>
      ) : null}

      <div className="btn-row">
        <button
          type="button"
          className={run.voicedAudioUrl ? "btn" : "btn btn-primary"}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? "Converting" : run.voicedAudioUrl ? "Convert again" : "Upload take audio"}
        </button>
        {run.voicedAudioUrl ? (
          <a href={run.voicedAudioUrl} download className="btn btn-primary" style={{ textDecoration: "none" }}>
            Download for CapCut
          </a>
        ) : null}
      </div>
    </>
  );
}
