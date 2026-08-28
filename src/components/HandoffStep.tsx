"use client";

import type { Run } from "@/db/schema";
import { HIGGSFIELD_URL } from "@/lib/render";
import CopyButton from "./CopyButton";
import UploadStep from "./UploadStep";

/**
 * The render, as a handoff rather than a trigger.
 *
 * On a flat monthly subscription the render happens on higgsfield.ai and per-render cost
 * is zero, so there is nothing here to estimate and nothing to queue. This step's whole
 * job is to get three things out of the app and one thing back in: the prompt, the two
 * input files, and then the finished MP4.
 */
export default function HandoffStep({
  run,
  prompt,
  onUploaded,
}: {
  run: Run;
  prompt: string;
  onUploaded: (url: string) => void;
}) {
  const ready = Boolean(run.sourceClipUrl && run.characterStillUrl && prompt);

  return (
    <>
      <ol className="handoff">
        <li>
          <span className="handoff-num">1</span>
          <div>
            <p className="handoff-title">Copy the prompt</p>
            <div className="readout" style={{ marginTop: "0.625rem", maxHeight: "11rem" }}>
              {prompt || "Composes itself once there is a character and a beat sheet."}
            </div>
            <div className="btn-row" style={{ marginTop: "0.625rem" }}>
              <CopyButton text={prompt} label="Copy prompt" />
            </div>
          </div>
        </li>

        <li>
          <span className="handoff-num">2</span>
          <div>
            <p className="handoff-title">Take the two inputs</p>
            <p className="stat-sub">
              @Video1 is the take you filmed and controls all the motion. @Image1 is the character
              still and controls identity. Add them in that order.
            </p>
            <div className="rows" style={{ marginTop: "0.625rem" }}>
              <div className="row">
                <span className="row-key">@Video1</span>
                <span className="mono handoff-url">{run.sourceClipUrl ?? "not uploaded yet"}</span>
                {run.sourceClipUrl ? <CopyChip text={run.sourceClipUrl} /> : <span />}
              </div>
              <div className="row">
                <span className="row-key">@Image1</span>
                <span className="mono handoff-url">{run.characterStillUrl ?? "not uploaded yet"}</span>
                {run.characterStillUrl ? <CopyChip text={run.characterStillUrl} /> : <span />}
              </div>
            </div>
          </div>
        </li>

        <li>
          <span className="handoff-num">3</span>
          <div>
            <p className="handoff-title">Generate on Higgsfield</p>
            <div className="rows" style={{ marginTop: "0.625rem" }}>
              {[
                ["Model", "Seedance 2.5 Edit"],
                ["Mode", "Prompt"],
                ["Resolution", "1080p"],
                ["Bitrate", "High"],
                ["Sound", "Off"],
              ].map(([k, v]) => (
                <div className="row" key={k} style={{ gridTemplateColumns: "7rem 1fr" }}>
                  <span className="row-key">{k}</span>
                  <span className="mono">{v}</span>
                </div>
              ))}
            </div>
            <p className="stat-sub" style={{ marginTop: "0.625rem" }}>
              Sound off is not a style choice. It keeps each generation focused on what actually
              fails, which is motion, face, hands, product and clothing. It also stops the model
              replacing your voice with a synthetic one, which is the whole reason this beats text
              to video.
            </p>
            <p className="note note-warn" style={{ marginTop: "0.625rem" }}>
              Attach both references before pasting anything, and bind them through the @ menu so
              the reference chips actually appear. Typing the text @Video1 without binding it
              leaves the prompt pointing at nothing.
            </p>
            <div className="btn-row" style={{ marginTop: "0.625rem" }}>
              <a
                href={HIGGSFIELD_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                Open higgsfield.ai
              </a>
            </div>
          </div>
        </li>

        <li>
          <span className="handoff-num">4</span>
          <div>
            <p className="handoff-title">Bring the MP4 back</p>
            <p className="stat-sub">
              Uploading it here marks the run complete and unlocks the finish step.
            </p>
            <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem", justifyItems: "start" }}>
              <UploadStep
                runId={run.id}
                kind="result"
                currentUrl={run.resultUrl}
                onUploaded={(url) => onUploaded(url)}
              />
            </div>
          </div>
        </li>
      </ol>

      {!ready ? (
        <p className="note note-warn">
          The prompt and both input files need to exist before this handoff is worth starting.
        </p>
      ) : null}
    </>
  );
}

function CopyChip({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="row-action"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      copy
    </button>
  );
}
