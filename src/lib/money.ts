import { desc } from "drizzle-orm";
import { db } from "@/db";
import { runs, type Run } from "@/db/schema";

/**
 * Spend rollup. Kept as one self-contained query so it lifts into Affiliate Engine's
 * Money tab unchanged when the two are wired together.
 *
 * A video that costs $12 in rerolls needs to be visible as such, so in-flight runs count
 * at their estimate rather than being invisible until they land.
 */

export const GOAL_CENTS = 100_000;
export const GOAL_DATE = "September 27";

export type DaySpend = { day: string; cents: number; runCount: number };

export type MoneySummary = {
  spentCents: number;
  committedCents: number;
  runsWithSpend: Run[];
  byDay: DaySpend[];
};

/** What a run actually cost, falling back to its estimate while it is still in flight. */
export function runCostCents(run: Run): number {
  if (run.actualCost !== null) return run.actualCost;
  if (run.status === "queued" || run.status === "rendering") return run.estimatedCost ?? 0;
  return 0;
}

export async function moneySummary(): Promise<MoneySummary> {
  const all = await db.select().from(runs).orderBy(desc(runs.createdAt));

  let spentCents = 0;
  let committedCents = 0;
  const days = new Map<string, DaySpend>();

  for (const run of all) {
    const cents = runCostCents(run);
    if (cents === 0) continue;

    if (run.actualCost !== null) {
      spentCents += cents;
    } else {
      committedCents += cents;
    }

    const day = run.createdAt.toISOString().slice(0, 10);
    const entry = days.get(day) ?? { day, cents: 0, runCount: 0 };
    entry.cents += cents;
    entry.runCount += 1;
    days.set(day, entry);
  }

  return {
    spentCents,
    committedCents,
    runsWithSpend: all.filter((run) => runCostCents(run) > 0),
    byDay: [...days.values()].sort((a, b) => b.day.localeCompare(a.day)),
  };
}
