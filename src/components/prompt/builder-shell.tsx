"use client";

/**
 * The two column builder layout, shared by both generators.
 *
 * Control panel left at a fixed width, output panel right taking the remainder. Below
 * 900px it collapses to one column with the controls first, because on a phone the thing
 * you came to change matters more than the thing you came to read.
 */
export default function BuilderShell({
  controls,
  output,
}: {
  controls: React.ReactNode;
  output: React.ReactNode;
}) {
  return (
    <div className="builder">
      <div className="builder-controls">{controls}</div>
      <div className="builder-output">{output}</div>
    </div>
  );
}
