"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Beat } from "@/db/schema";

/**
 * The teleprompter.
 *
 * This is a companion display, not a camera preview. The operator films on the phone's
 * own camera app and reads this beside them.
 *
 * The clock is the contract. The same beat timings are rendered back out into the edit
 * prompt, so drift between what was filmed and what the prompt claims is the main way
 * this whole pipeline fails. Everything below is driven off a single performance.now()
 * origin sampled inside requestAnimationFrame, never off accumulated setInterval ticks,
 * because interval accumulation is exactly how that drift gets introduced: every tick
 * lands a few milliseconds late and the error compounds across a fifteen second take.
 */

const COUNTDOWN_SECONDS = 3;
// A beat brightens this long before it becomes current, so the operator sees it coming.
const LOOKAHEAD_SECONDS = 1;

type Phase = "idle" | "countdown" | "running" | "finished";

export default function Teleprompter({ runId, beats }: { runId: number; beats: Beat[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const originRef = useRef(0);
  const frameRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const total = beats.reduce((sum, beat) => sum + beat.duration, 0);

  /**
   * Keeps the screen awake for the length of the take. Falls back silently: an operator
   * whose browser lacks Wake Lock still gets a working teleprompter, their screen just
   * may dim, which is a far better outcome than an error.
   */
  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Denied or unsupported. Nothing to do, and nothing worth telling the operator.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const start = useCallback(() => {
    acquireWakeLock();
    setPhase("countdown");
    setElapsed(-COUNTDOWN_SECONDS);
    originRef.current = performance.now() + COUNTDOWN_SECONDS * 1000;
  }, [acquireWakeLock]);

  useEffect(() => {
    if (phase !== "countdown" && phase !== "running") return;

    function frame() {
      // Every frame recomputes from the one origin. No accumulation, so no drift.
      const seconds = (performance.now() - originRef.current) / 1000;
      setElapsed(seconds);

      if (seconds >= 0 && phase === "countdown") {
        setPhase("running");
      }
      if (seconds >= total) {
        setPhase("finished");
        releaseWakeLock();
        return;
      }
      frameRef.current = requestAnimationFrame(frame);
    }

    frameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, total, releaseWakeLock]);

  useEffect(() => releaseWakeLock, [releaseWakeLock]);

  async function markFilmed() {
    await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "filmed" }),
    });
    router.push(`/runs/${runId}`);
    router.refresh();
  }

  const currentIndex = beats.findIndex(
    (beat) => elapsed >= beat.at && elapsed < beat.at + beat.duration,
  );
  const current = currentIndex >= 0 ? beats[currentIndex] : null;
  const next = currentIndex >= 0 ? beats[currentIndex + 1] : beats[0];

  const beatProgress = current ? Math.min(1, Math.max(0, (elapsed - current.at) / current.duration)) : 0;
  const nextIsImminent = current
    ? current.at + current.duration - elapsed <= LOOKAHEAD_SECONDS
    : false;

  return (
    <div className="prompter">
      {phase === "idle" ? (
        <div className="prompter-center">
          <p className="prompter-hint">
            Prop the phone up, open the camera app, start recording, then start this.
            <br />
            Three second countdown, then {total.toFixed(1)} seconds of take.
          </p>
          <button type="button" className="btn btn-primary" onClick={start}>
            Start countdown
          </button>
        </div>
      ) : null}

      {phase === "countdown" ? (
        <div className="prompter-center">
          <div className="prompter-count">{Math.max(1, Math.ceil(-elapsed))}</div>
        </div>
      ) : null}

      {phase === "running" ? (
        <>
          <div className="prompter-elapsed">
            <span className="prompter-dot" />
            {elapsed.toFixed(1)}s / {total.toFixed(1)}s
          </div>

          <div className="prompter-center">
            <div className="prompter-action">{current?.action ?? ""}</div>
            {current?.line ? <div className="prompter-line">{current.line}</div> : null}

            {/* Time left inside this beat, not the whole clip. */}
            <div className="prompter-bar">
              <div className="prompter-bar-fill" style={{ width: `${beatProgress * 100}%` }} />
            </div>

            <div className="prompter-next" data-soon={nextIsImminent}>
              <b>next</b>
              {next ? next.action : "hold, then stop recording"}
            </div>
          </div>
        </>
      ) : null}

      {phase === "finished" ? (
        <div className="prompter-center">
          <div className="prompter-count" style={{ fontSize: "3.5rem", color: "var(--ok)" }}>
            {total.toFixed(1)}s
          </div>
          <p className="prompter-hint">Stop recording. Did the take match the plan?</p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={markFilmed}>
              Matched the plan
            </button>
            <button type="button" className="btn" onClick={start}>
              Redo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
