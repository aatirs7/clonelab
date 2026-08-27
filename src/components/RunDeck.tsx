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
import SignOutButton from "./SignOutButton";
import UploadStep from "./UploadStep";

/**
 * The run, as a deck: every step listed down the rail, one step in front of you at a time.
 *
 * Every step is always reachable and always renders. Steps used to be hard disabled until
 * their prerequisites were met, which meant nothing past step one could be opened,
 * inspected or reviewed without first spending real money on a casting call. A step that
 * is missing its inputs now still shows what it is, says what it needs, and only refuses
 * to submit.
 *
 * Ordering still matters and is easy to get wrong. Seedance copies motion out of the
 * source clip and cannot invent a movement that was never filmed, so the shot plan is
 * written before filming, not after. The character still comes after filming too, because
 * the image pasted into ChatGPT is a screenshot of a frame that was actually shot.
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
  const rendered = run.status === "complete";
  const prompt = run.prompt ?? (run.character && run.beats ? editPrompt(run.character, run.beats) : "");

  type Step = {
    key: string;
    label: string;
    title: string;
    hint: string;
    done: boolean;
    /** Prerequisites met. When false the body still renders, it just cannot be submitted. */
    ready: boolean;
    /** What is missing, said plainly. Shown only when not ready. */
    needs?: string;
    body: React.ReactNode;
  };

  const steps: Step[] = [
    {
      key: "character",
      label: "Character",
      title: "Cast the presenter",
      hint: "One click writes all seven fields. Reroll anything that does not fit, or type over it.",
      done: hasCharacter,
      ready: true,
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
      ready: hasCharacter,
      needs: "Cast a character first, so the beats can be written for a specific person.",
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
      ready: hasBeats,
      needs: "Write the beat sheet first. The teleprompter has nothing to count through without it.",
      body: hasBeats ? (
        <Link href={`/runs/${run.id}/teleprompter`} className="btn btn-rec" style={{ textDecoration: "none" }}>
          Open teleprompter
        </Link>
      ) : (
        // A link cannot be disabled by the surrounding fieldset, so an unready step swaps
        // it for a button that can be.
        <button type="button" className="btn btn-rec">
          Open teleprompter
        </button>
      ),
    },
    {
      key: "clip",
      label: "Upload clip",
      title: "Upload the take",
      hint: "Trim to just the take first. fal bills the input duration alongside the output, so a long file costs real money for nothing.",
      done: hasClip,
      ready: true,
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
      ready: hasCharacter,
      needs: "Cast a character first. The prompt below is built from those seven fields.",
      body: (
        <>
          <p className="note note-warn">{STILL_INSTRUCTION}</p>
          {run.character ? (
            <>
              <div className="readout">{characterStillPrompt(run.character)}</div>
              <div className="btn-row">
                <CopyButton text={characterStillPrompt(run.character)} label="Copy prompt" />
              </div>
            </>
          ) : (
            <div className="readout" style={{ color: "var(--ink-faint)" }}>
              The ChatGPT prompt appears here once a character is cast. It asks for the person to be
              replaced while the pose, hand placement, lighting and the product are all held exactly
              as filmed.
            </div>
          )}
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
      ),
    },
    {
      key: "prompt",
      label: "Render prompt",
      title: "Check the render prompt",
      hint: run.promptEdited
        ? "You edited this by hand, so it no longer regenerates from the character or the beats."
        : "Composed from the character and the beat sheet. Edit it and it stops regenerating.",
      done: Boolean(prompt),
      ready: Boolean(prompt),
      needs: "Needs both a character and a beat sheet. It composes itself from the two.",
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
      done: rendered,
      ready: hasClip && hasStill && Boolean(prompt),
      needs: "Needs the source clip, the character still and a prompt. The estimate below still shows what it would cost.",
      body: <RenderStep run={run} onChanged={refresh} />,
    },
    {
      key: "finish",
      label: "Finish",
      title: "Finish in CapCut",
      hint: "Relay the original audio over the render. Timing is one to one, so it drops straight on with no nudging. Add the AI-generated label in the TikTok editor at post time, every time.",
      done: run.posted,
      ready: rendered || run.status === "failed",
      needs: "Nothing has finished rendering yet.",
      body: <Finish run={run} onPatch={(values) => { patch(values); refresh(); }} />,
    },
  ];

  // Open on the first thing that still needs doing, so the deck picks up where you left off.
  const firstUndone = steps.findIndex((step) => step.ready && !step.done);
  const [index, setIndex] = useState(firstUndone === -1 ? 0 : firstUndone);
  const active = steps[Math.min(index, steps.length - 1)];

  return (
    <div className="deck">
      <nav className="deck-rail">
        {/*
          The only way out of a run, and it needs an explicit accessible name: the visible
          text is split across two elements to colour the second half, and "exit to the run
          list" is not something the word alone conveys.
        */}
        <Link href="/" className="wordmark" aria-label="CloneLab, back to all runs">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          {steps.map((step, i) => (
            <button
              key={step.key}
              type="button"
              className="rail-item"
              aria-current={i === index ? "step" : undefined}
              data-state={i === index ? "active" : step.done ? "done" : "todo"}
              onClick={() => setIndex(i)}
            >
              <span className="rail-num">{step.done && i !== index ? "✓" : String(i + 1).padStart(2, "0")}</span>
              {step.label}
            </button>
          ))}
        </div>
        <div className="rail-footer">
          <SignOutButton />
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

          {!active.ready && active.needs ? (
            <p className="note note-warn" style={{ marginTop: "1.25rem" }}>
              {active.needs}
            </p>
          ) : null}

          {/*
            A disabled fieldset natively disables every control inside it, so an unready
            step renders in full and simply cannot be submitted. That is the point: any
            step can be read at any time without spending anything.
          */}
          <fieldset className="panel-body" disabled={!active.ready}>
            {active.body}
          </fieldset>

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
              disabled={index === steps.length - 1}
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
  const drift = saved && estimated && run.actualCost ? ((run.actualCost - estimated) / estimated) * 100 : null;

  return (
    <div className="rows">
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
    return (
      <p className="panel-hint" style={{ marginTop: 0 }}>
        Once a render lands, the finished MP4 appears here to download, along with the field for
        what fal actually billed.
      </p>
    );
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
