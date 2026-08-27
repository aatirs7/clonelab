import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { requireOperator } from "@/lib/auth";
import { formatCents } from "@/lib/cost";
import { GOAL_CENTS, GOAL_DATE, moneySummary, runCostCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  await requireOperator();
  const summary = await moneySummary();
  const total = summary.spentCents + summary.committedCents;
  const pct = Math.min(100, (total / GOAL_CENTS) * 100);

  return (
    <div className="deck">
      <nav className="deck-rail">
        <Link href="/" className="wordmark">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          <Link href="/" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">01</span>
            Runs
          </Link>
          <Link href="/money" className="rail-item" data-state="active" style={{ textDecoration: "none" }}>
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
          <p className="eyebrow">Render spend</p>
          <div className="figure" style={{ fontSize: "3.5rem" }}>{formatCents(total)}</div>
          <p className="panel-hint">
            {formatCents(summary.spentCents)} billed
            {summary.committedCents > 0
              ? `, ${formatCents(summary.committedCents)} committed and still rendering`
              : ""}
            . Against the {formatCents(GOAL_CENTS)} by {GOAL_DATE} goal.
          </p>

          <div className="prompter-bar" style={{ marginTop: "1.25rem" }}>
            <div className="prompter-bar-fill" style={{ width: `${pct}%` }} />
          </div>

          {summary.byDay.length > 0 ? (
            <div style={{ marginTop: "3rem" }}>
              <p className="eyebrow">By day</p>
              <div className="rows">
                {summary.byDay.map((day) => (
                  <div className="row" key={day.day} style={{ gridTemplateColumns: "1fr auto" }}>
                    <span className="mono" style={{ fontSize: "0.8125rem", color: "var(--ink-dim)" }}>
                      {day.day} · {day.runCount} render{day.runCount === 1 ? "" : "s"}
                    </span>
                    <span className="mono">{formatCents(day.cents)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {summary.runsWithSpend.length > 0 ? (
            <div style={{ marginTop: "2rem" }}>
              <p className="eyebrow">By run</p>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {summary.runsWithSpend.map((run) => (
                  <Link key={run.id} href={`/runs/${run.id}`} className="run-item">
                    <span>
                      {run.productName}
                      <br />
                      <span className="tag">
                        {run.resolution} · {run.seconds}s
                        {run.actualCost === null ? " · estimate, still rendering" : ""}
                      </span>
                    </span>
                    <span className="mono">{formatCents(runCostCents(run))}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p className="panel-hint" style={{ marginTop: "2rem" }}>Nothing rendered yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
