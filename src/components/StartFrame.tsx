"use client";

import { useRef, useState } from "react";

/**
 * Pulls the first frame out of the take.
 *
 * This is the single biggest lever on output stability, and it is the part of the process
 * most likely to be skipped because it sounds optional. Feeding the image model the start
 * frame of the motion video gives it the exact original pose, angle and hand placement.
 * The character prompt then says to keep all of that and replace only the person, so the
 * resulting @Image1 is already geometrically aligned with @Video1.
 *
 * Doing it here rather than describing it in a doc is the whole point: the aligned image
 * becomes the default path rather than a thing you have to know.
 */
export default function StartFrame({ clipUrl }: { clipUrl: string | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extract(src: string, revoke: boolean) {
    setBusy(true);
    setError(null);

    const video = document.createElement("video");
    // Only matters for a remote URL. A local blob: URL is same-origin already.
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("That video could not be read in the browser."));
      });

      // Nudged just off zero: seeking to exactly 0 returns a blank buffer in several
      // browsers, which produces a black frame rather than the first real one.
      video.currentTime = Math.min(0.06, (video.duration || 1) / 2);
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Could not seek to the first frame."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");
      ctx.drawImage(video, 0, 0);

      // Throws a SecurityError if the source tainted the canvas, which is the one failure
      // worth naming precisely rather than reporting as a generic problem.
      setFrame(canvas.toDataURL("image/png"));
    } catch (e) {
      const message = (e as Error).message;
      setError(
        message.includes("tainted") || (e as Error).name === "SecurityError"
          ? "The browser would not let this frame be read from the hosted file. Pick the clip from your disk instead, which always works."
          : message,
      );
    } finally {
      if (revoke) URL.revokeObjectURL(src);
      setBusy(false);
    }
  }

  return (
    <div className="rows">
      <div className="row" style={{ gridTemplateColumns: "1fr" }}>
        <p className="stat-sub" style={{ marginTop: 0, textAlign: "left" }}>
          Give the image model the first frame of your take, not a random screenshot. It carries
          the exact pose, camera angle and hand placement, so the still that comes back is already
          lined up with the video and holds far better through the render.
        </p>
      </div>

      {frame ? (
        <div className="row" style={{ gridTemplateColumns: "1fr" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frame} alt="First frame of the take" className="thumb" style={{ maxWidth: "13rem", margin: "0 auto" }} />
        </div>
      ) : null}

      {error ? (
        <div className="row" style={{ gridTemplateColumns: "1fr" }}>
          <p className="note note-warn" style={{ margin: 0 }}>{error}</p>
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) extract(URL.createObjectURL(file), true);
          e.target.value = "";
        }}
      />

      <div className="row" style={{ gridTemplateColumns: "1fr" }}>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          {clipUrl ? (
            <button type="button" className="btn" onClick={() => extract(clipUrl, false)} disabled={busy}>
              {busy ? "Reading" : "Grab from the uploaded clip"}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? "Reading" : "Grab from a file on this device"}
          </button>
          {frame ? (
            <a href={frame} download="start-frame.png" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Download frame
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
