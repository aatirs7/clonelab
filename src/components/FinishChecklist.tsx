"use client";

import { useState } from "react";

/**
 * The pre-export checklist, as a gate rather than a doc.
 *
 * These eight are the difference between a usable clip and a reshoot, and they are the
 * easiest thing in the process to skip, which is exactly why they gate marking a run
 * posted instead of sitting in a playbook nobody opens at 1am.
 */
export const CHECKS: { key: string; label: string }[] = [
  { key: "identity", label: "Identity stayed consistent across the whole clip" },
  { key: "handsFace", label: "Hands and face look natural" },
  { key: "clothing", label: "Clothing and product stayed consistent" },
  { key: "motion", label: "Motion matches the reference" },
  { key: "camera", label: "Camera movement stayed accurate" },
  { key: "artifacts", label: "No flickering or warping" },
  { key: "background", label: "Background stayed believable" },
  { key: "product", label: "Product details are correct" },
];

export default function FinishChecklist({
  runId,
  checked,
  onChange,
}: {
  runId: number;
  checked: string[];
  onChange: (next: string[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const done = CHECKS.filter((c) => checked.includes(c.key)).length;
  const allDone = done === CHECKS.length;

  async function toggle(key: string) {
    const next = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key];
    onChange(next);
    setSaving(true);
    await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ finishChecks: next }),
    });
    setSaving(false);
  }

  return (
    <div className="rows">
      <div className="row" style={{ gridTemplateColumns: "1fr auto" }}>
        <span className="row-key">Before export</span>
        <span className="mono" style={{ color: allDone ? "var(--ok)" : "var(--ink-dim)" }}>
          {done}/{CHECKS.length}
          {saving ? " saving" : ""}
        </span>
      </div>

      {CHECKS.map((check) => {
        const on = checked.includes(check.key);
        return (
          <div className="row" key={check.key} style={{ gridTemplateColumns: "auto 1fr" }}>
            <input
              type="checkbox"
              id={`chk-${check.key}`}
              checked={on}
              onChange={() => toggle(check.key)}
              style={{ accentColor: "var(--ok)", width: 15, height: 15 }}
            />
            <label
              htmlFor={`chk-${check.key}`}
              style={{
                textAlign: "left",
                fontSize: "0.875rem",
                cursor: "pointer",
                color: on ? "var(--ink-dim)" : "var(--ink)",
                textDecoration: on ? "line-through" : "none",
              }}
            >
              {check.label}
            </label>
          </div>
        );
      })}

      {!allDone ? (
        <div className="row" style={{ gridTemplateColumns: "1fr" }}>
          <p className="note note-warn" style={{ margin: 0 }}>
            Reject the take if the output changed the scene: background shifts, camera angle
            changes, clothing morphs, faces flicker, hands melt, or the timing no longer matches
            the source. If any of that drifts frame to frame, fix the references rather than
            adding more prompt. Over-prompting a bad reference usually makes it worse.
          </p>
        </div>
      ) : null}
    </div>
  );
}
