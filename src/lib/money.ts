import { desc } from "drizzle-orm";
import { db } from "@/db";
import { runs, type Run } from "@/db/schema";

/**
 * Spend, earned, net.
 *
 * The goal is a commission target, so progress toward it is measured in commission
 * EARNED. Render spend is a cost line and moves the opposite way: a run that cost twelve
 * dollars in rerolls has taken you further from the goal, not closer. Measuring the goal
 * against spend, as this once did, inverted the sign of the whole page.
 *
 * Kept as one self-contained module so it lifts into Affiliate Engine's Money tab intact.
 */

export const GOAL_CENTS = 100_000;
export const GOAL_DATE = "September 27";
/** Absolute, so the countdown does not drift with the clock. */
export const GOAL_DEADLINE = new Date("2026-09-27T23:59:59Z");

export type DayPoint = {
  day: string;
  spendCents: number;
  earnedCents: number;
  /** Running total of earnings up to and including this day. */
  cumulativeEarnedCents: number;
  /** Running total of earnings minus spend. Can be negative, and usually starts that way. */
  cumulativeNetCents: number;
  runCount: number;
};

export type MoneySummary = {
  spentCents: number;
  committedCents: number;
  earnedCents: number;
  netCents: number;
  goalCents: number;
  goalPct: number;
  daysLeft: number;
  runsWithMoney: Run[];
  byDay: DayPoint[];
  /** Renders that cost money but have no earnings recorded yet. */
  unreportedCount: number;
};

/** What a run cost, falling back to its estimate while it is still in flight. */
export function runCostCents(run: Run): number {
  if (run.actualCost !== null) return run.actualCost;
  if (run.status === "queued" || run.status === "rendering") return run.estimatedCost ?? 0;
  return 0;
}

export function runEarnedCents(run: Run): number {
  return run.commissionEarned ?? 0;
}

export async function moneySummary(now: Date = new Date()): Promise<MoneySummary> {
  const all = await db.select().from(runs).orderBy(desc(runs.createdAt));

  let spentCents = 0;
  let committedCents = 0;
  let earnedCents = 0;
  let unreportedCount = 0;

  const days = new Map<string, { spendCents: number; earnedCents: number; runCount: number }>();

  for (const run of all) {
    const cost = runCostCents(run);
    const earned = runEarnedCents(run);
    if (cost === 0 && earned === 0) continue;

    if (run.actualCost !== null) spentCents += cost;
    else committedCents += cost;

    earnedCents += earned;
    if (cost > 0 && run.commissionEarned === null && run.status === "complete") {
      unreportedCount += 1;
    }

    const day = run.createdAt.toISOString().slice(0, 10);
    const entry = days.get(day) ?? { spendCents: 0, earnedCents: 0, runCount: 0 };
    entry.spendCents += cost;
    entry.earnedCents += earned;
    entry.runCount += 1;
    days.set(day, entry);
  }

  // Ascending for the time series, because a cumulative line has to accumulate forwards.
  const ordered = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let runningEarned = 0;
  let runningNet = 0;
  const byDay: DayPoint[] = ordered.map(([day, entry]) => {
    runningEarned += entry.earnedCents;
    runningNet += entry.earnedCents - entry.spendCents;
    return {
      day,
      spendCents: entry.spendCents,
      earnedCents: entry.earnedCents,
      cumulativeEarnedCents: runningEarned,
      cumulativeNetCents: runningNet,
      runCount: entry.runCount,
    };
  });

  const msLeft = GOAL_DEADLINE.getTime() - now.getTime();

  return {
    spentCents,
    committedCents,
    earnedCents,
    netCents: earnedCents - (spentCents + committedCents),
    goalCents: GOAL_CENTS,
    goalPct: Math.min(100, (earnedCents / GOAL_CENTS) * 100),
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    runsWithMoney: all.filter((run) => runCostCents(run) > 0 || runEarnedCents(run) > 0),
    byDay,
    unreportedCount,
  };
}
