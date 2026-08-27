"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Beat, Character, Run } from "@/db/schema";
import { formatCents } from "@/lib/cost";
import { characterStillPrompt, editPrompt, STILL_INSTRUCTION } from "@/lib/prompts";
import BeatSheet from "./BeatSheet";
import CharacterBlock from "./CharacterBlock";
import CopyButton from "./CopyButton";
import PromptEditor from "./PromptEditor";
import RenderStep from "./RenderStep";
import UploadStep from "./UploadStep";

/**
 * The run, as a deck: every step listed down the rail, one step in front of you at a time.
 *
 * Ordering matters and is easy to get wrong. Seedance copies motion out of the source clip
 * and cannot invent a movement that was never filmed, so the shot plan is written before
 * filming, not after. The character still comes after filming too, because the image
 * pasted into ChatGPT is a screenshot of a frame the operator actually shot.
 */
export default function RunDeck({ run: initial, operatorAge }: { run: Run; operatorAge: number }) {
  const router = useRouter();

  /*
    Local state so a step updates the instant its own request returns, rather than waiting
    on a server round trip. The server component re-renders on router.refresh(), and this
    is the sanctioned way to fold those fresh props back in: without it the local copy
    would win forever and a render that finished while the page was open would never show.
  */
  const [seen, setSeen] = useState(initial);
  const [run, setRun] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setRun(initial);
  }

  const refresh = useCallback(() => router.refresh(), [router]);

  function patch(values: Partial<Run>) {
    setRun((current) => ({ ...current, ...values }));
  }

  const hasCharacter = Boolean(run.character);
  const hasBeats = Boolean(run.beats?.length);
  const hasClip = Boolean(run.sourceClipUrl);
  const hasStill = Boolean(run.characterStillUrl);
  const prompt = run.prompt ?? (run.character && run.beats ? editPrompt(run.character, run.beats) : "");

  const steps = [
    {
      key: "character",
      label: "Character",
      title: "Cast the presenter",
      hint: "One click writes all seven fields. Reroll anything that does not fit, or type over it.",
      done: hasCharacter,
      open: true,
      body: (
        <CharacterBlock
          run={run}
          operatorAge={operatorAge}
          onSaved={(character: Character) => {
            patch({ character });
            refresh();
          }}
        />
      ),
    },
    {
      key: "beats",
      label: "Beat sheet",
      title: "Write the beat sheet",
      hint: "Timed movement cues, 8 to 15 seconds, one continuous take. You film against this, so it is written before you shoot, not after.",
      done: hasBeats,
      open: hasCharacter,
      body: (
        <BeatSheet
          run={run}
          onSaved={(beats: Beat[]) => {
            patch({ beats, seconds: Math.round(beats.reduce((sum, b) => sum + b.duration, 0)) });
            refresh();
          }}
        />
      ),
    },
    {
      key: "film",
      label: "Film",
      title: "Film the take",
      hint: "The teleprompter runs beside you. Film on the camera app, speak the lines out loud, and stay in one spot facing the camera.",
      done: run.status === "filmed" || hasClip,
      open: hasBeats,
      body: (
        <Link href={`/runs/${run.id}/teleprompter`} className="btn btn-rec" style={{ textDecoration: "none" }}>
          Open teleprompter
        </Link>
      ),
    },
    {
      key: "clip",
      label: "Upload clip",
      title: "Upload the take",
      hint: "Trim to just the take first. fal bills the input duration alongside the output, so a long file costs real money for nothing.",
      done: hasClip,
      open: hasBeats,
      body: (
        <UploadStep
          runId={run.id}
          kind="clip"
          currentUrl={run.sourceClipUrl}
          currentSeconds={run.sourceClipSeconds}
          onUploaded={(url, seconds) => {
            patch({ sourceClipUrl: url, sourceClipSeconds: seconds ?? null });
            refresh();
          }}
        />
      ),
    },
    {
      key: "still",
      label: "Character still",
      title: "Make the character still",
      hint: "Screenshot a frame from the take you just filmed, paste this into ChatGPT with it, then upload what comes back.",
      done: hasStill,
      open: hasClip,
      body: run.character ? (
        <>
          <p className="note note-warn">{STILL_INSTRUCTION}</p>
          <div className="readout">{characterStillPrompt(run.character)}</div>
          <div className="btn-row">
            <CopyButton text={characterStillPrompt(run.character)} label="Copy prompt" />
          </div>
          <UploadStep
            runId={run.id}
            kind="still"
            currentUrl={run.characterStillUrl}
            onUploaded={(url) => {
              patch({ characterStillUrl: url });
              refresh();
            }}
          />
        </>
      ) : null,
    },
    {
      key: "prompt",
      label: "Render prompt",
      title: "Check the render prompt",
      hint: run.promptEdited
        ? "You edited this by hand, so it no longer regenerates from the character or the beats."
        : "Composed from the character and the beat sheet. Edit it and it stops regenerating.",
      done: Boolean(prompt),
      open: hasBeats,
      body: (
        <PromptEditor
          runId={run.id}
          prompt={prompt}
          edited={run.promptEdited}
          onChanged={(next, edited) => {
            patch({ prompt: next || null, promptEdited: edited });
            refresh();
          }}
        />
      ),
    },
    {
      key: "render",
      label: "Render",
      title: "Render it",
      hint: "480p by default. Promote a take you already like to 720p, reusing the same prompt and inputs.",
      done: run.status === "complete",
      open: hasClip && hasStill,
      body: <RenderStep run={run} onChanged={refresh} />,
    },
    {
      key: "finish",
      label: "Finish",
      title: "Finish in CapCut",
      hint: "Relay the original audio over the render. Timing is one to one, so it drops straight on with no nudging. Add the AI-generated label in the TikTok editor at post time, every time.",
      done: run.posted,
      open: run.status === "complete" || run.status === "failed",
      body: <Finish run={run} onPatch={(values) => { patch(values); refresh(); }} />,
    },
  ];

  // Open on the first thing that still needs doing, so the deck picks up where you left off.
  const firstUndone = steps.findIndex((step) => step.open && !step.done);
  const [index, setIndex] = useState(firstUndone === -1 ? 0 : firstUndone);
  const active = steps[Math.min(index, steps.length - 1)];

  return (
    <div className="deck">
      <nav className="deck-rail">
        <Link href="/" className="wordmark">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          {steps.map((step, i) => (
            <button
              key={step.key}
              type="button"
              className="rail-item"
              disabled={!step.open}
              data-state={i === index ? "active" : step.done ? "done" : "todo"}
              onClick={() => setIndex(i)}
              title={step.open ? undefined : "Not reachable yet"}
            >
              <span className="rail-num">{step.done && i !== index ? "✓" : String(i + 1).padStart(2, "0")}</span>
              {step.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="deck-stage">
        <div className="stage-inner">
          <p className="eyebrow">
            {run.productName}
            {run.hookAngle ? ` / ${run.hookAngle}` : ""}
          </p>
          <h1 className="panel-title">{active.title}</h1>
          <p className="panel-hint">{active.hint}</p>

          <div className="panel-body">{active.body}</div>

          <div className="btn-row" style={{ marginTop: "2.5rem", justifyContent: "space-between" }}>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={index === steps.length - 1 || !steps[index + 1]?.open}
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * The estimator implements the formula fal publishes, but fal's own page also quotes a
 * per-second rate that does not reconcile with it, and the build spec quotes a third
 * number. Nothing settles that except a real bill, and the queue API does not report one.
 * So the operator reads it off the fal dashboard once and types it in here.
 */
function ActualCost({ run, onPatch }: { run: Run; onPatch: (values: Partial<Run>) => void }) {
  const [value, setValue] = useState(run.actualCost !== null ? (run.actualCost / 100).toFixed(2) : "");
  const [saved, setSaved] = useState(run.actualCost !== null);

  async function save() {
    const cents = Math.round(Number(value) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    await fetch(`/api/runs/${run.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actualCost: cents }),
    });
    setSaved(true);
    onPatch({ actualCost: cents });
  }

  const estimated = run.estimatedCost;
  const drift =
    saved && estimated && run.actualCost
      ? ((run.actualCost - estimated) / estimated) * 100
      : null;

  return (
    <div className="rows" style={{ marginTop: "0.5rem" }}>
      <div className="row">
        <span className="row-key">Estimated</span>
        <span className="mono">{formatCents(estimated)}</span>
        <span />
      </div>
      <div className="row">
        <span className="row-key">Billed</span>
        <input
          className="row-value mono"
          inputMode="decimal"
          placeholder="read it off fal"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
        />
        <button type="button" className="row-action" onClick={save} disabled={saved || !value}>
          {saved ? "saved" : "save"}
        </button>
      </div>
      {drift !== null ? (
        <div className="row">
          <span className="row-key">Drift</span>
          <span className="mono" style={{ color: Math.abs(drift) > 15 ? "var(--rec)" : "var(--ok)" }}>
            {drift > 0 ? "+" : ""}
            {drift.toFixed(0)}% against the estimate
          </span>
          <span />
        </div>
      ) : null}
    </div>
  );
}

function Finish({ run, onPatch }: { run: Run; onPatch: (values: Partial<Run>) => void }) {
  if (run.status === "failed") {
    return <p className="note note-rec">{run.falError ?? "The render failed."}</p>;
  }

  if (run.status !== "complete" || !run.resultUrl) {
    return <p className="panel-hint" style={{ marginTop: 0 }}>Nothing rendered yet.</p>;
  }

  return (
    <>
      <video src={run.resultUrl} controls playsInline className="thumb" style={{ maxWidth: "13rem" }} />
      <div className="btn-row">
        <a href={run.resultUrl} download className="btn btn-primary" style={{ textDecoration: "none" }}>
          Download MP4
        </a>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await fetch(`/api/runs/${run.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ posted: !run.posted }),
            });
            onPatch({ posted: !run.posted });
          }}
        >
          {run.posted ? "Posted" : "Mark posted"}
        </button>
      </div>

      <ActualCost run={run} onPatch={onPatch} />
    </>
  );
}
