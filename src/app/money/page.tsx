import Link from "next/link";
import MoneyDashboard from "@/components/MoneyDashboard";
import SignOutButton from "@/components/SignOutButton";
import { requireOperator } from "@/lib/auth";
import { formatCents } from "@/lib/cost";
import { moneySummary, runCostCents, runEarnedCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  await requireOperator();
  const summary = await moneySummary();

  return (
    <div className="deck">
      <nav className="deck-rail">
        <Link href="/" className="wordmark" aria-label="CloneLab, back to all runs">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          <Link href="/" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">01</span>
            Runs
          </Link>
          <Link href="/research" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">02</span>
            Research
          </Link>
          <Link href="/money" className="rail-item" data-state="active" style={{ textDecoration: "none" }}>
            <span className="rail-num">03</span>
            Money
          </Link>
        </div>
        <div className="rail-footer">
          <SignOutButton />
        </div>
      </nav>

      <main className="deck-stage">
        <div className="stage-inner" style={{ maxWidth: "44rem" }}>
          <p className="eyebrow">Money</p>
          <h1 className="panel-title">Earned against spend</h1>
          <p className="panel-hint">
            The goal is a commission target, so progress is measured in what the videos earned.
            Render spend is a cost line and moves the other way.
          </p>

          <div className="dash-stack" style={{ marginTop: "2rem" }}>
            <MoneyDashboard summary={summary} />

            {summary.runsWithMoney.length > 0 ? (
              <section className="card">
                <div className="card-head">
                  <span className="card-title">By run</span>
                </div>
                <div style={{ display: "grid", gap: "0.375rem" }}>
                  {summary.runsWithMoney.map((run) => {
                    const cost = runCostCents(run);
                    const earned = runEarnedCents(run);
                    const net = earned - cost;
                    return (
                      <Link key={run.id} href={`/runs/${run.id}`} className="run-item">
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {run.product.name}
                          <br />
                          <span className="tag">
                            {run.resolution} · {run.seconds}s
                            {run.actualCost === null && cost > 0 ? " · estimate, still rendering" : ""}
                          </span>
                        </span>
                        <span style={{ textAlign: "right" }}>
                          <span className="mono" style={{ color: net >= 0 ? "var(--ok)" : "var(--rec)" }}>
                            {net >= 0 ? "" : "-"}
                            {formatCents(Math.abs(net))}
                          </span>
                          <br />
                          <span className="tag">
                            {formatCents(earned)} in · {formatCents(cost)} out
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
