import type { ScoreComponent } from "@/db/schema";

/**
 * Scoring is profile-driven, never hardcoded.
 *
 * A profile is one format's rubric: the same six criteria, different thresholds, and for
 * criteria 4 and 5 potentially different data sources entirely. The livestream profile is
 * the first; a short video profile is coming. The engine reads whichever profile it is
 * handed and a product records which one scored it, because a score is meaningless
 * without knowing the rubric that produced it.
 */

/** Everything phase one can see, straight off product/rank. */
export type PhaseOneInput = {
  unitPrice: number | null;
  commissionRate: number | null;
};

/** Everything phase two adds: one product/detail pair and one creator/rank. */
export type PhaseTwoInput = {
  /** Daily revenue, oldest first, from a long-window product/detail. */
  revenueTrend: number[];
  /** creator_number from a last7Day product/detail, which is a different call. */
  creatorNumber7d: number | null;
  /** creator/rank rows for this product, revenue DESC, last7Day. */
  creatorRevenues: number[];
};

export type Criterion<TInput> = {
  key: string;
  label: string;
  max: number;
  /** Returns points plus the bucket that was hit, in words. */
  score: (input: TInput) => { points: number; reason: string };
};

export type ScoreProfile = {
  name: string;
  label: string;
  /** Window the detail call should use for the trend. */
  detailDateRange: string;
  phaseOne: Criterion<PhaseOneInput>[];
  phaseTwo: Criterion<PhaseTwoInput>[];
  bands: { min: number; label: string; tone: "strong" | "test" | "marginal" | "pass" }[];
};

export type ScoreResult = {
  profile: string;
  total: number;
  max: number;
  band: string;
  tone: "strong" | "test" | "marginal" | "pass";
  components: ScoreComponent[];
};

export function band(profile: ScoreProfile, total: number) {
  // Descending, so the first threshold the total clears is the one that applies.
  const hit = [...profile.bands].sort((a, b) => b.min - a.min).find((b) => total >= b.min);
  return hit ?? profile.bands[profile.bands.length - 1];
}
