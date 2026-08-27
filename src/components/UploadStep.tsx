"use client";

import { useRef, useState } from "react";
import { MAX_CLIP_SECONDS, MIN_CLIP_SECONDS } from "@/lib/cost";

/**
 * Measures a video's duration in the browser before uploading it.
 *
 * Worth doing client side rather than server side for two reasons: fal rejects anything
 * outside its window outright, so a bad file should never be uploaded at all, and the
 * duration is a billed quantity we need on the run for the cost estimate.
 */
function measureDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = document.createElement("video");
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(element.src);
      resolve(element.duration);
    };
    element.onerror = () => {
      URL.revokeObjectURL(element.src);
      reject(new Error("That file could not be read as a video."));
    };
    element.src = URL.createObjectURL(file);
  });
}

export default function UploadStep({
  runId,
  kind,
  currentUrl,
  currentSeconds,
  onUploaded,
}: {
  runId: number;
  kind: "clip" | "still" | "result";
  currentUrl: string | null;
  currentSeconds?: number | null;
  onUploaded: (url: string, seconds?: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);

    if (kind === "clip") {
      try {
        const seconds = await measureDuration(file);
        if (seconds < MIN_CLIP_SECONDS || seconds > MAX_CLIP_SECONDS) {
          setError(
            `That clip is ${seconds.toFixed(1)}s. Seedance only accepts ${MIN_CLIP_SECONDS} to ${MAX_CLIP_SECONDS}s of ` +
              "source, so trim it before uploading.",
          );
          setBusy(false);
          return;
        }
        form.set("seconds", String(seconds));
      } catch (measureError) {
        setError((measureError as Error).message);
        setBusy(false);
        return;
      }
    }

    const response = await fetch(`/api/runs/${runId}/upload`, { method: "POST", body: form });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "The upload failed.");
      setBusy(false);
      return;
    }

    onUploaded(data.url, data.seconds);
    setBusy(false);
  }

  return (
    <>
      {currentUrl ? (
        kind === "still" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Character still" className="thumb" style={{ maxWidth: "11rem" }} />
        ) : (
          <video src={currentUrl} controls playsInline className="thumb" style={{ maxWidth: "11rem" }} />
        )
      ) : null}

      {currentUrl && currentSeconds ? (
        <p className="tag" style={{ color: "var(--ok)" }}>
          Uploaded · {currentSeconds.toFixed(1)}s · inside the 1.8 to 30.2s the model accepts
        </p>
      ) : null}

      <input
        ref={input}
        type="file"
        accept={kind === "still" ? "image/*" : "video/*"}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />

      {error ? <p className="note note-rec">{error}</p> : null}

      <div className="btn-row">
        <button
          type="button"
          className={currentUrl ? "btn" : "btn btn-primary"}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy
            ? "Uploading"
            : currentUrl
              ? "Replace"
              : kind === "clip"
                ? "Choose clip"
                : kind === "still"
                  ? "Choose still"
                  : "Upload finished MP4"}
        </button>
      </div>
    </>
  );
}
