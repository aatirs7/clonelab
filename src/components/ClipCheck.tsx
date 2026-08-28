"use client";

import { useRef, useState } from "react";
import { MAX_CLIP_SECONDS, MIN_CLIP_SECONDS } from "@/lib/cost";

/**
 * Checks the take without uploading it.
 *
 * The clip is only ever handed to Higgsfield from the operator's own disk, so hosting it
 * bought nothing but waiting. What still matters is the length gate: Seedance rejects
 * anything outside 1.8 to 30.2 seconds, and finding that out at the render is a wasted
 * trip. The duration is measured in the browser and only the number is kept.
 */
export default function ClipCheck({
  runId,
  seconds,
  onChecked,
}: {
  runId: number;
  seconds: number | null;
  onChecked: (seconds: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function measure(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const element = document.createElement("video");
      element.preload = "metadata";
      element.onloadedmetadata = () => resolve(element.duration);
      element.onerror = () => reject(new Error("That file could not be read as a video."));
      element.src = URL.createObjectURL(file);
    });
  }

  async function check(file: File) {
    setBusy(true);
    setError(null);
    try {
      const measured = await measure(file);
      if (measured < MIN_CLIP_SECONDS || measured > MAX_CLIP_SECONDS) {
        setError(
          `That take is ${measured.toFixed(1)}s. Seedance only accepts ${MIN_CLIP_SECONDS} to ` +
            `${MAX_CLIP_SECONDS}s of source, so trim it before you hand it over.`,
        );
        setBusy(false);
        return;
      }

      // Session only. Nothing leaves the browser.
      setPreview(URL.createObjectURL(file));

      await fetch(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceClipSeconds: measured, status: "filmed" }),
      });
      onChecked(measured);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      {preview ? (
        <video src={preview} controls playsInline className="thumb" style={{ maxWidth: "11rem" }} />
      ) : null}

      {seconds ? (
        <p className="tag" style={{ color: "var(--ok)" }}>
          Checked · {seconds.toFixed(1)}s · inside the 1.8 to 30.2s Seedance accepts
        </p>
      ) : null}

      <input
        ref={input}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) check(file);
          e.target.value = "";
        }}
      />

      {error ? <p className="note note-rec">{error}</p> : null}

      <p className="stat-sub">
        The file stays on this device. Only its length is recorded, because that is the one thing
        that can fail later.
      </p>

      <div className="btn-row">
        <button
          type="button"
          className={seconds ? "btn" : "btn btn-primary"}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? "Reading" : seconds ? "Check another take" : "Check the take"}
        </button>
      </div>
    </>
  );
}
