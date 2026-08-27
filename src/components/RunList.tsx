"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RunWithProduct } from "@/lib/runs";
import { formatCents } from "@/lib/cost";

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  planned: "planned",
  filmed: "filmed",
  still_ready: "ready",
  queued: "queued",
  rendering: "rendering",
  complete: "done",
  failed: "failed",
};

/**
 * Runs are cheap to make and most get abandoned, so they need to be cheap to throw away
 * too. Without a delete, a run whose casting call failed was a permanent dead end that
 * still counted in the list forever.
 *
 * Delete confirms in place rather than through window.confirm, which blocks the page and
 * cannot be styled. Two clicks, and the second one is labelled with what it will do.
 */
export default function RunList({
  runs,
  spendByRun,
}: {
  runs: RunWithProduct[];
  spendByRun: Record<number, number>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number) {
    setBusy(id);
    await fetch(`/api/runs/${id}`, { method: "DELETE" });
    setConfirming(null);
    setBusy(null);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "0.375rem" }}>
      {runs.map((run) => {
        const spend = spendByRun[run.id] ?? 0;
        return (
          <div key={run.id} className="run-item">
            <Link
              href={`/runs/${run.id}`}
              style={{ color: "inherit", textDecoration: "none", flex: 1, minWidth: 0 }}
            >
              {run.product.name}
            </Link>
            <span className="tag">
              {STATUS_LABEL[run.status]}
              {spend > 0 ? ` · ${formatCents(spend)}` : ""}
            </span>
            {confirming === run.id ? (
              <span style={{ display: "flex", gap: "0.25rem" }}>
                <button
                  type="button"
                  className="row-action"
                  style={{ color: "var(--rec)", borderColor: "var(--rec)" }}
                  onClick={() => remove(run.id)}
                  disabled={busy === run.id}
                >
                  {busy === run.id ? "deleting" : "delete for good"}
                </button>
                <button type="button" className="row-action" onClick={() => setConfirming(null)}>
                  keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="row-action"
                aria-label={`Delete the run for ${run.product.name}`}
                onClick={() => setConfirming(run.id)}
              >
                delete
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
