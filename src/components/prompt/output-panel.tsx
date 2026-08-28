"use client";

import { useState } from "react";

/**
 * The output side: a toolbar strip with a copy button, an optional slot grid, and the
 * prompt itself.
 *
 * The prompt block stays left aligned even though the house rule centers everything else.
 * It is a code block, and centering a wrapped paragraph of instruction text would make it
 * genuinely harder to read.
 */
export default function OutputPanel({
  label,
  text,
  grid,
  footer,
}: {
  label: string;
  text: string;
  grid?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="builder-toolbar">
        <span className="eyebrow" style={{ margin: 0 }}>{label}</span>
        <button type="button" className="btn btn-primary" onClick={copy} disabled={!text}>
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      {grid}
      <pre className="prompt-out">{text}</pre>
      {footer}
    </>
  );
}
