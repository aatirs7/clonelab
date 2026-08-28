"use client";

import { useMemo, useState } from "react";
import {
  buildRenderPrompt,
  modeCopy,
  strictnessCopy,
  type RenderMode,
  type Strictness,
} from "@/lib/prompt/templates/render";
import BuilderShell from "./builder-shell";
import OutputPanel from "./output-panel";

const STRICTNESS_HELP: Record<Strictness, string> = {
  strict: "The reference video is law. Use this for almost every run.",
  natural: "Allows tiny physical corrections so the replacement fits.",
  adaptive: "Allows natural fit adaptation where the replacement needs it.",
};

/**
 * The render prompt builder.
 *
 * Deterministic: a mode and a strictness level pick fixed copy. The negative list and the
 * preserve list never vary because the failure modes of Seedance edit mode are known, so
 * there is nothing here for a model to improve on and nothing worth paying for.
 */
export default function RenderPromptBuilder({
  initial,
  beatTimings,
  onChange,
}: {
  initial?: {
    mode?: string | null;
    strictness?: string | null;
    extra?: string | null;
  };
  /** The beat sheet rendered as timestamp prose, if the run has one. */
  beatTimings?: string | null;
  onChange?: (state: { mode: RenderMode; strictness: Strictness; extra: string; prompt: string }) => void;
}) {
  const [mode, setMode] = useState<RenderMode>((initial?.mode as RenderMode) || "person");
  const [strictness, setStrictness] = useState<Strictness>(
    (initial?.strictness as Strictness) || "strict",
  );
  const [extra, setExtra] = useState(initial?.extra ?? "");

  const prompt = useMemo(
    () => buildRenderPrompt({ mode, strictness, extra }),
    [mode, strictness, extra],
  );

  const controls = (
    <>
      <p className="eyebrow">Seedance edit mode</p>

      <div className="builder-field">
        <label className="label" htmlFor="rp-mode">Prompt mode</label>
        <select id="rp-mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as RenderMode)}>
          {(Object.keys(modeCopy) as RenderMode[]).map((key) => (
            <option key={key} value={key}>
              {modeCopy[key].label}
            </option>
          ))}
        </select>
        <span className="builder-help">
          Replace the person is the one almost every CloneLab run wants.
        </span>
      </div>

      <div className="builder-field">
        <label className="label" htmlFor="rp-strict">Strictness</label>
        <select
          id="rp-strict"
          className="field"
          value={strictness}
          onChange={(e) => setStrictness(e.target.value as Strictness)}
        >
          {(Object.keys(strictnessCopy) as Strictness[]).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <span className="builder-help">{STRICTNESS_HELP[strictness]}</span>
      </div>

      <div className="builder-field">
        <label className="label" htmlFor="rp-extra">Extra instruction</label>
        <textarea
          id="rp-extra"
          className="field"
          rows={4}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="keep the cap logo readable throughout"
        />
        <span className="builder-help">
          Optional. Inserted second and worded as subordinate, so it can never read as
          overriding the reference hierarchy.
        </span>
      </div>

      {/*
        The old prompt restated the beat sheet as timestamps, on the theory that repeating
        motion the model can already see raises adherence. This generator has no slot for
        that, so it is offered here rather than lost.
      */}
      {beatTimings ? (
        <div className="builder-field">
          <button
            type="button"
            className="btn"
            onClick={() => setExtra(beatTimings)}
            disabled={extra === beatTimings}
          >
            {extra === beatTimings ? "Beat timings inserted" : "Insert beat timings"}
          </button>
          <span className="builder-help">
            Restates your beat sheet as timestamps. Seedance reads timestamp phrasing, and naming
            motion it can already see tends to raise adherence.
          </span>
        </div>
      ) : null}

      <div className="btn-row" style={{ justifyContent: "center" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onChange?.({ mode, strictness, extra, prompt })}
        >
          {onChange ? "Save prompt" : "Update prompt"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMode("person");
            setStrictness("strict");
            setExtra("");
          }}
        >
          Reset
        </button>
      </div>
    </>
  );

  return <BuilderShell controls={controls} output={<OutputPanel label="Render prompt" text={prompt} />} />;
}
