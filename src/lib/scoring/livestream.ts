import type { Criterion, PhaseOneInput, PhaseTwoInput, ScoreProfile } from "./types";

/**
 * The livestream profile. One hundred points across six criteria.
 *
 * A short video profile will reuse these six criteria with different thresholds and, for
 * creator ceiling and revenue distribution, different data sources. Nothing here is
 * imported outside this file: the engine takes whichever profile it is given.
 */

/* ---------------------------------------------------------------- helpers */

/**
 * Trailing window sums off a daily series that runs oldest first.
 *
 * Direction matters enormously and was verified against the live API rather than assumed:
 * summing the array equals the window's own revenue total, and the last seven entries of
 * a 30 day array are byte for byte the last7Day array. Reading it backwards would turn
 * every growth score into a decline score.
 */
function tail(series: number[], days: number): number {
  return series.slice(-days).reduce((sum, n) => sum + n, 0);
}

/**
 * Drops leading zeros before analysing shape.
 *
 * A 90 day window on a product launched six weeks ago opens with weeks of zeros. Those
 * are "did not exist yet", not "sold nothing", and left in they make a healthy product
 * look like a dead one that spiked.
 */
function sinceLaunch(series: number[]): number[] {
  const first = series.findIndex((n) => n > 0);
  return first === -1 ? [] : series.slice(first);
}

function weeklyBuckets(series: number[]): number[] {
  const live = sinceLaunch(series);
  const weeks: number[] = [];
  // Walk backwards from the most recent day so the final partial week is the offcut,
  // not the most recent one.
  for (let end = live.length; end > 0; end -= 7) {
    weeks.unshift(live.slice(Math.max(0, end - 7), end).reduce((s, n) => s + n, 0));
  }
  return weeks;
}

/** Percentage change of a daily rate, so windows of different length are comparable. */
function dailyRate(series: number[], days: number): number {
  const window = Math.min(days, series.length);
  return window === 0 ? 0 : tail(series, window) / window;
}

/* ---------------------------------------------------------------- phase one */

/**
 * Criterion 3, commission economics. From rank alone, so it runs on all 100 candidates
 * before anything expensive happens.
 */
const commissionEconomics: Criterion<PhaseOneInput> = {
  key: "commission",
  label: "Commission economics",
  max: 20,
  score: ({ unitPrice, commissionRate }) => {
    if (unitPrice === null || commissionRate === null) {
      return { points: 0, reason: "no price or commission rate returned" };
    }
    // commission_rate is percentage points: 1.0 means 1%, so divide by 100 exactly once.
    const dollars = (unitPrice * commissionRate) / 100;
    const shown = `$${dollars.toFixed(2)} per sale`;
    if (dollars >= 15) return { points: 20, reason: `${shown}, at or above $15` };
    if (dollars >= 8) return { points: 12, reason: `${shown}, $8 to $15` };
    if (dollars >= 3) return { points: 5, reason: `${shown}, $3 to $8` };
    return { points: 0, reason: `${shown}, under $3` };
  },
};

/* ---------------------------------------------------------------- phase two */

/**
 * Criterion 1, growth acceleration. Derived from the daily trend rather than from two
 * rank calls at different windows, because matching products across two ranked lists is
 * fragile and costs an extra call besides.
 */
const growthAcceleration: Criterion<PhaseTwoInput> = {
  key: "growth",
  label: "Growth acceleration",
  max: 20,
  score: ({ revenueTrend }) => {
    const live = sinceLaunch(revenueTrend);
    if (live.length < 14) return { points: 0, reason: "not enough history to judge growth" };

    const recent7 = dailyRate(live, 7);
    const prior30 = dailyRate(live.slice(0, -7), 30);
    if (prior30 === 0) {
      // Nothing to divide by. That is genuinely unknown rather than good or bad, so it
      // lands in the flat bucket rather than being rewarded as infinite growth.
      return { points: 5, reason: "no meaningful revenue in the prior 30 days to compare against" };
    }

    // Both are daily rates, so the ratio is a like-for-like comparison of pace.
    const deltaPct = ((recent7 - prior30) / prior30) * 100;
    const shown = `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(0)}% pace vs the prior 30 days`;
    if (deltaPct > 15) return { points: 20, reason: `${shown}, accelerating` };
    if (deltaPct >= 5) return { points: 12, reason: `${shown}, rising` };
    if (deltaPct >= -5) return { points: 5, reason: `${shown}, flat` };
    return { points: 0, reason: `${shown}, declining` };
  },
};

/**
 * Criterion 6, trend durability. Same array, bucketed into weeks.
 *
 * "Sustained" is counted in MATERIAL weeks, not merely non-zero ones. Real trend data is
 * spiky and sparse: a product that took eighty dollars across eleven scattered weeks and
 * then did a hundred and twenty thousand in one is a single spike, but counting non-zero
 * weeks scored it as five weeks of durable demand. A week only counts if it reached a
 * fifth of the product's own peak.
 */
const trendDurability: Criterion<PhaseTwoInput> = {
  key: "durability",
  label: "Trend durability",
  max: 10,
  score: ({ revenueTrend }) => {
    const weeks = weeklyBuckets(revenueTrend).filter((w) => w > 0);
    if (weeks.length <= 1) return { points: 0, reason: "a single week of data" };

    const peak = Math.max(...weeks);
    const latest = weeks[weeks.length - 1];
    const material = weeks.filter((w) => w >= peak * 0.2);
    const pctOfPeak = Math.round((latest / peak) * 100);
    // Sustained means still near its own peak, not merely non-zero.
    const holding = latest >= peak * 0.5;

    if (material.length <= 1) {
      return {
        points: 2,
        reason: `one big week out of ${weeks.length}, the rest are noise`,
      };
    }
    if (material.length >= 6 && holding) {
      return { points: 10, reason: `${material.length} solid weeks, still at ${pctOfPeak}% of peak` };
    }
    if (!holding) {
      return { points: 2, reason: `spiked then fell to ${pctOfPeak}% of peak` };
    }
    return { points: 6, reason: `${material.length} solid weeks, holding at ${pctOfPeak}% of peak` };
  },
};

/** Criterion 2, competition density. Fewer creators on it is better. */
const competitionDensity: Criterion<PhaseTwoInput> = {
  key: "competition",
  label: "Competition density",
  max: 20,
  score: ({ creatorNumber7d }) => {
    if (creatorNumber7d === null) return { points: 0, reason: "no creator count returned" };
    const n = creatorNumber7d;
    if (n < 10) return { points: 20, reason: `${n} creators in 7 days, barely touched` };
    if (n <= 30) return { points: 12, reason: `${n} creators in 7 days` };
    if (n <= 75) return { points: 5, reason: `${n} creators in 7 days, crowded` };
    return { points: 0, reason: `${n} creators in 7 days, saturated` };
  },
};

/**
 * Criterion 4, creator ceiling.
 *
 * Kalodata reports a creator's TOTAL revenue on the product across the window, not their
 * per-livestream revenue. So this is a 7 day figure and is labelled as one everywhere it
 * appears. Treating it as per-stream would overstate the ceiling by however many streams
 * they ran.
 */
const creatorCeiling: Criterion<PhaseTwoInput> = {
  key: "ceiling",
  label: "Creator ceiling",
  max: 15,
  score: ({ creatorRevenues }) => {
    const top3 = creatorRevenues.slice(0, 3);
    if (top3.length === 0) return { points: 0, reason: "no creators found on this product" };
    const mean = top3.reduce((s, n) => s + n, 0) / top3.length;
    const shown = `$${Math.round(mean).toLocaleString()} mean top-3 revenue over 7 days`;
    if (mean >= 10_000) return { points: 15, reason: `${shown}` };
    if (mean >= 3_000) return { points: 10, reason: `${shown}` };
    if (mean >= 500) return { points: 5, reason: `${shown}` };
    return { points: 0, reason: `${shown}, no real ceiling` };
  },
};

/** Criterion 5, revenue distribution. One creator owning it all is a closed door. */
const revenueDistribution: Criterion<PhaseTwoInput> = {
  key: "distribution",
  label: "Revenue distribution",
  max: 15,
  score: ({ creatorRevenues }) => {
    const total = creatorRevenues.reduce((s, n) => s + n, 0);
    if (total === 0 || creatorRevenues.length === 0) {
      return { points: 0, reason: "no creator revenue to distribute" };
    }
    const share = (creatorRevenues[0] / total) * 100;
    const shown = `top creator holds ${share.toFixed(0)}% of ${creatorRevenues.length} creators`;
    if (share < 25) return { points: 15, reason: `${shown}, wide open` };
    if (share < 45) return { points: 9, reason: shown };
    if (share < 70) return { points: 3, reason: `${shown}, concentrated` };
    return { points: 0, reason: `${shown}, effectively one creator` };
  },
};

export const livestreamProfile: ScoreProfile = {
  name: "livestream",
  label: "Livestream",
  // last60Day is the one named range product/detail rejects with a 500, so the profile
  // asks for 90 days. It is a longer trend anyway, which criterion 6 wants.
  detailDateRange: "last90Day",
  phaseOne: [commissionEconomics],
  phaseTwo: [growthAcceleration, competitionDensity, creatorCeiling, revenueDistribution, trendDurability],
  bands: [
    { min: 80, label: "Strong", tone: "strong" },
    { min: 60, label: "Worth testing", tone: "test" },
    { min: 40, label: "Marginal", tone: "marginal" },
    { min: 0, label: "Pass", tone: "pass" },
  ],
};
