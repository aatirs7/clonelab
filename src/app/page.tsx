import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { requireOperator } from "@/lib/auth";
import { formatCents } from "@/lib/cost";
import { runCostCents } from "@/lib/money";
import { listRuns } from "@/lib/runs";
import NewRunForm from "@/components/NewRunForm";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  await requireOperator();
  const runs = await listRuns();

  return (
    <div className="deck">
      <nav className="deck-rail">
        <Link href="/" className="wordmark">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          <Link href="/" className="rail-item" data-state="active" style={{ textDecoration: "none" }}>
            <span className="rail-num">01</span>
            Runs
          </Link>
          <Link href="/money" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">02</span>
            Money
          </Link>
        </div>
        <div className="rail-footer">
          <SignOutButton />
        </div>
      </nav>

      <main className="deck-stage">
        <div className="stage-inner">
          <p className="eyebrow">New run</p>
          <h1 className="panel-title">Start a run</h1>
          <p className="panel-hint">
            Name the product and the angle. Everything after that is a click.
          </p>

          <div className="panel-body">
            <NewRunForm />
          </div>

          {runs.length > 0 ? (
            <div style={{ marginTop: "3rem" }}>
              <p className="eyebrow">{runs.length} run{runs.length === 1 ? "" : "s"}</p>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {runs.map((run) => (
                  <Link key={run.id} href={`/runs/${run.id}`} className="run-item">
                    <span>{run.productName}</span>
                    <span className="tag">
                      {STATUS_LABEL[run.status]}
                      {runCostCents(run) > 0 ? ` · ${formatCents(runCostCents(run))}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
