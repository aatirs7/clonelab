"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Beat, Character, Run } from "@/db/schema";
import type { RunWithProduct } from "@/lib/runs";
import { formatCents } from "@/lib/cost";
import {
  characterStillPrompt,
  compositeStillPrompt,
  COMPOSITE_INSTRUCTION,
  editPrompt,
  NO_SAMPLE_FILMING_NOTE,
  STILL_INSTRUCTION,
} from "@/lib/prompts";
import BeatSheet from "./BeatSheet";
import CharacterBlock from "./CharacterBlock";
import CopyButton from "./CopyButton";
import PromptEditor from "./PromptEditor";
import HandoffStep from "./HandoffStep";
import RenderStep from "./RenderStep";
import SignOutButton from "./SignOutButton";
import UploadStep from "./UploadStep";
import CharacterBuilder from "./prompt/character-builder";
import RenderPromptBuilder from "./prompt/render-prompt-builder";
import { useRunPersist } from "./prompt/use-run-persist";
import { beatsAsTimestamps } from "@/lib/prompts";
import VoiceStep from "./VoiceStep";

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
export default function RunDeck({
  run: initial,
  operatorAge,
  provider,
}: {
  run: RunWithProduct;
  operatorAge: number;
  provider: "manual" | "fal";
}) {
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
  const { save } = useRunPersist(initial.id);

  function patch(values: Partial<Run>) {
    setRun((current) => ({ ...current, ...values }));
  }

  /** The product is a nested record, so it cannot go through patch(). */
  function patchProduct(values: Partial<RunWithProduct["product"]>) {
    setRun((current) => ({ ...current, product: { ...current.product, ...values } }));
  }

  const hasCharacter = Boolean(run.character);
  const hasBeats = Boolean(run.beats?.length);
  const hasClip = Boolean(run.sourceClipUrl);
  const hasStill = Boolean(run.characterStillUrl);
  const rendered = run.status === "complete";
  const hasSample = run.product.hasSample;
  // The Kalodata image is the default; a manual upload only exists because that one was
  // unusable, so it wins.
  const productPhoto = run.product.uploadedImageUrl ?? run.product.imageUrl ?? null;
  const prompt =
    run.renderPrompt ??
    run.prompt ??
    (run.character && run.beats ? editPrompt(run.character, run.beats, run.product.name) : "");

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
        <>
          {/* The builder rolls a presenter and emits the image prompt. The seven field
              sheet below stays as the record the rest of the pipeline reads. */}
          <CharacterBuilder
            initial={{
              seed: run.characterSeed,
              roll: run.characterRoll,
              productInstruction: run.product.name,
            }}
            onChange={({ seed, roll, prompt }) => {
              save({ characterSeed: seed, characterRoll: roll, characterPrompt: prompt });
              patch({ characterSeed: seed, characterRoll: roll, characterPrompt: prompt });
            }}
          />
          <CharacterBlock
            run={run}
            operatorAge={operatorAge}
            onSaved={(character: Character) => {
              patch({ character });
              refresh();
            }}
          />
        </>
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
        <>
          {!hasSample ? <p className="note note-warn">{NO_SAMPLE_FILMING_NOTE}</p> : null}
          <Link href={`/runs/${run.id}/teleprompter`} className="btn btn-rec" style={{ textDecoration: "none" }}>
            Open teleprompter
          </Link>
        </>
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
      hint: "Trim to just the take first. The model only accepts 1.8 to 30.2 seconds of source, and a long file makes the render slower for nothing.",
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
          <p className="note note-warn">{hasSample ? STILL_INSTRUCTION : COMPOSITE_INSTRUCTION}</p>

          {/* Read only replay of whatever the builder produced on step 1, so the still is
              generated from the same text that was saved rather than a fresh roll. */}
          {run.characterPrompt ? (
            <div className="rows">
              <div className="row" style={{ gridTemplateColumns: "1fr auto" }}>
                <span className="row-key">Saved image prompt</span>
                <span className="tag">
                  seed <span className="mono">{run.characterSeed ?? "none"}</span>
                </span>
              </div>
              <div className="row" style={{ gridTemplateColumns: "1fr" }}>
                <pre className="prompt-out" style={{ minHeight: 0, padding: "0.75rem 0", fontSize: 13 }}>
                  {run.characterPrompt}
                </pre>
              </div>
              <div className="row" style={{ gridTemplateColumns: "1fr" }}>
                <CopyButton text={run.characterPrompt} label="Copy saved prompt" />
              </div>
            </div>
          ) : null}

          {!hasSample ? (
            <ProductPhoto
              run={run}
              photo={productPhoto}
              onUploaded={(url) => {
                patchProduct({ uploadedImageUrl: url });
                refresh();
              }}
            />
          ) : null}

          {run.character ? (
            <>
              <div className="readout">
                {hasSample
                  ? characterStillPrompt(run.character)
                  : compositeStillPrompt(run.character, run.product)}
              </div>
              <div className="btn-row">
                <CopyButton
                  text={
                    hasSample
                      ? characterStillPrompt(run.character)
                      : compositeStillPrompt(run.character, run.product)
                  }
                  label="Copy prompt"
                />
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

          {/* Side by side, because the only thing worth checking is whether the product
              in the still is actually the product in the photo. */}
          {!hasSample && productPhoto && run.characterStillUrl ? (
            <div className="compare">
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productPhoto} alt="The real product" className="thumb" />
                <figcaption className="tag">the real product</figcaption>
              </figure>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={run.characterStillUrl} alt="Generated still" className="thumb" />
                <figcaption className="tag">what came back</figcaption>
              </figure>
            </div>
          ) : null}
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
        <>
          <RenderPromptBuilder
            initial={{
              mode: run.renderPromptMode,
              strictness: run.renderPromptStrictness,
              extra: run.renderPromptExtra,
            }}
            beatTimings={run.beats?.length ? beatsAsTimestamps(run.beats) : null}
            onChange={({ mode, strictness, extra, prompt: built }) => {
              save({
                renderPromptMode: mode,
                renderPromptStrictness: strictness,
                renderPromptExtra: extra,
                renderPrompt: built,
                prompt: built,
              });
              patch({
                renderPromptMode: mode,
                renderPromptStrictness: strictness,
                renderPromptExtra: extra,
                renderPrompt: built,
                prompt: built,
                promptEdited: true,
              });
            }}
          />

          <details className="builder-advanced">
            <summary>Edit the saved text by hand</summary>
            <PromptEditor
              runId={run.id}
              prompt={prompt}
              edited={run.promptEdited}
              onChanged={(next, edited) => {
                patch({ prompt: next || null, promptEdited: edited });
                refresh();
              }}
            />
          </details>
        </>
      ),
    },
    {
      key: "render",
      label: "Render",
      title: provider === "fal" ? "Render it" : "Hand off to Higgsfield",
      hint:
        provider === "fal"
          ? "480p by default. Promote a take you already like to 720p, reusing the same prompt and inputs."
          : "The render runs on your Higgsfield subscription, so this step is a handoff. Take the prompt and the two files across, generate, then bring the MP4 back.",
      done: rendered,
      ready: hasClip && hasStill && Boolean(prompt),
      needs: "Needs the source clip, the character still and a prompt.",
      body:
        provider === "fal" ? (
          <RenderStep run={run} onChanged={refresh} />
        ) : (
          <HandoffStep
            run={run}
            prompt={prompt}
            onUploaded={(url) => {
              patch({ resultUrl: url, status: "complete" });
              refresh();
            }}
          />
        ),
    },
    {
      key: "voice",
      label: "Voice",
      title: "Convert the voice",
      hint: "Speech to speech, never text to speech. Your take drives the lip motion in the render, so the conversion has to keep your exact timing. Generated speech would make up its own and drift out of sync.",
      done: Boolean(run.voicedAudioUrl),
      ready: rendered,
      needs: "Nothing has finished rendering yet.",
      body: (
        <VoiceStep
          run={run}
          onConverted={(url) => {
            patch({ voicedAudioUrl: url });
            refresh();
          }}
        />
      ),
    },
    {
      key: "finish",
      label: "Finish",
      title: "Finish in CapCut",
      hint: "Drop the audio over the render. Timing is one to one either way, so it lands with no nudging. Add the AI-generated label in the TikTok editor at post time, every time.",
      done: run.posted,
      ready: rendered || run.status === "failed",
      needs: "Nothing has finished rendering yet.",
      body: <Finish run={run} onPatch={(values) => { patch(values); refresh(); }} provider={provider} />,
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
            {run.product.name}
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

/** One editable money field, stored as integer cents. */
function MoneyRow({
  runId,
  label,
  field,
  cents,
  placeholder,
  onPatch,
}: {
  runId: number;
  label: string;
  field: "actualCost" | "commissionEarned";
  cents: number | null;
  placeholder: string;
  onPatch: (values: Partial<Run>) => void;
}) {
  const [value, setValue] = useState(cents !== null ? (cents / 100).toFixed(2) : "");
  const [saved, setSaved] = useState(cents !== null);

  async function save() {
    const next = Math.round(Number(value) * 100);
    if (!Number.isFinite(next) || next < 0) return;
    await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    setSaved(true);
    onPatch({ [field]: next } as Partial<Run>);
  }

  return (
    <div className="row">
      <span className="row-key">{label}</span>
      <input
        className="row-value mono"
        inputMode="decimal"
        placeholder={placeholder}
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
  );
}

/**
 * The two numbers nothing in the pipeline can know.
 *
 * fal reports what a render cost but its queue API does not return the bill, and the
 * published formula has three conflicting figures attached to it, so the estimate only
 * gets calibrated by reading the real one off the dashboard. TikTok reports what a video
 * earned, and the two systems never meet. Both are typed in here, once, per run.
 */
function RunLedger({
  run,
  onPatch,
  provider,
}: {
  run: Run;
  onPatch: (values: Partial<Run>) => void;
  provider: "manual" | "fal";
}) {
  const estimated = run.estimatedCost;
  const drift =
    run.actualCost !== null && estimated ? ((run.actualCost - estimated) / estimated) * 100 : null;
  const net = (run.commissionEarned ?? 0) - (run.actualCost ?? 0);
  const haveBoth = run.commissionEarned !== null && run.actualCost !== null;

  return (
    <div className="rows">
      {provider === "fal" ? (
        <div className="row">
          <span className="row-key">Estimated</span>
          <span className="mono" style={{ color: "var(--ink-dim)" }}>{formatCents(estimated)}</span>
          <span />
        </div>
      ) : null}
      <MoneyRow
        runId={run.id}
        label="Cost"
        field="actualCost"
        cents={run.actualCost}
        placeholder={provider === "fal" ? "read it off fal" : "subscription share, or 0"}
        onPatch={onPatch}
      />
      {provider === "fal" && drift !== null ? (
        <div className="row">
          <span className="row-key">Drift</span>
          <span className="mono" style={{ color: Math.abs(drift) > 15 ? "var(--rec)" : "var(--ok)" }}>
            {drift > 0 ? "+" : ""}
            {drift.toFixed(0)}% against the estimate
          </span>
          <span />
        </div>
      ) : null}
      <MoneyRow
        runId={run.id}
        label="Earned"
        field="commissionEarned"
        cents={run.commissionEarned}
        placeholder="commission from TikTok"
        onPatch={onPatch}
      />
      {haveBoth ? (
        <div className="row">
          <span className="row-key">Net</span>
          <span className="mono" style={{ color: net >= 0 ? "var(--ok)" : "var(--rec)" }}>
            {net >= 0 ? "" : "-"}
            {formatCents(Math.abs(net))}
          </span>
          <span />
        </div>
      ) : null}
    </div>
  );
}

function Finish({
  run,
  onPatch,
  provider,
}: {
  run: Run;
  onPatch: (values: Partial<Run>) => void;
  provider: "manual" | "fal";
}) {
  if (run.status === "failed") {
    return <p className="note note-rec">{run.falError ?? "The render failed."}</p>;
  }

  if (run.status !== "complete" || !run.resultUrl) {
    return (
      <p className="panel-hint" style={{ marginTop: 0 }}>
        Once the finished MP4 is uploaded on the previous step, it appears here to download, along
        with the fields for what it cost and what the post earned.
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

      <RunLedger run={run} onPatch={onPatch} provider={provider} />
    </>
  );
}

/**
 * The product photo used for compositing. Kalodata supplies one automatically for picked
 * products; this is the override for when that image is missing or too poor to work from.
 */
function ProductPhoto({
  run,
  photo,
  onUploaded,
}: {
  run: RunWithProduct;
  photo: string | null;
  onUploaded: (url: string) => void;
}) {
  return (
    <div className="rows">
      <div className="row">
        <span className="row-key">Product photo</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="candidate-img" />
          ) : null}
          <span className="tag">
            {run.product.uploadedImageUrl
              ? "uploaded by hand"
              : run.product.imageUrl
                ? "from Kalodata"
                : "none yet, the composite needs one"}
          </span>
        </span>
        <span />
      </div>
      <div className="row" style={{ gridTemplateColumns: "1fr" }}>
        <UploadStep runId={run.id} kind="product" currentUrl={null} onUploaded={onUploaded} />
      </div>
    </div>
  );
}
