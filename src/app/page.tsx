import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { requireOperator } from "@/lib/auth";
import { runCostCents } from "@/lib/money";
import { listRuns } from "@/lib/runs";
import NewRunForm from "@/components/NewRunForm";
import RunList from "@/components/RunList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireOperator();
  const runs = await listRuns();

  const spendByRun = Object.fromEntries(runs.map((run) => [run.id, runCostCents(run)]));

  return (
    <div className="deck">
      <nav className="deck-rail">
        <Link href="/" className="wordmark" aria-label="CloneLab, back to all runs">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          <Link href="/" className="rail-item" data-state="active" style={{ textDecoration: "none" }}>
            <span className="rail-num">01</span>
            Runs
          </Link>
          <Link href="/research" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">02</span>
            Research
          </Link>
          <Link href="/money" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">03</span>
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
            Pick a product from Kalodata, or name one yourself. The angle is yours either way,
            since nothing in the data supplies it.
          </p>

          <div className="panel-body">
            <NewRunForm />
          </div>

          {runs.length > 0 ? (
            <div style={{ marginTop: "3rem" }}>
              <p className="eyebrow">
                {runs.length} run{runs.length === 1 ? "" : "s"}
              </p>
              <RunList runs={runs} spendByRun={spendByRun} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
