import "server-only";
import type { ScoreComponent } from "@/db/schema";
import {
  creatorRank,
  productDetail,
  productRank,
  videoRank,
  type ProductRankRow,
  type VideoRankRow,
} from "./kalodata/client";
import { getProfile, scoreFull, scorePhaseOne, type ScoreResult } from "./scoring";

/**
 * The two-phase sweep.
 *
 * Full scoring costs three extra calls per product, so it is not run on everything.
 * Phase one ranks 100 candidates and scores the one criterion that needs nothing but the
 * rank row. Phase two takes only the survivors and pays for the rest.
 *
 * Cost, so it is not a surprise: phase one is one call. Phase two is three per survivor,
 * a long-window detail for the trend, a last7Day detail for the creator count at the
 * window the rubric is calibrated for, and a creator/rank. At the default 25 survivors
 * that is 76 calls, roughly 76 cents.
 */

export const SURVIVORS = 25;

export type Candidate = {
  productId: string;
  name: string;
  imageUrl: string | null;
  sellerId: string | null;
  sellerName: string | null;

  revenue: number | null;
  commissionRate: number | null;
  unitPrice: number | null;
  salesVolumn: number | null;
  /* Only ever present on rank. It cannot be recovered later, so it is captured here. */
  revenueGrowthRate: number | null;
  launchDate: string | null;

  liveRevenue: number | null;
  videoRevenue: number | null;
  showcaseRevenue: number | null;
  /** Share of revenue by surface. Displayed on every candidate, never used to gate. */
  formatSplit: { live: number; video: number; showcase: number } | null;

  /** Phase one only until the product survives into phase two. */
  partialScore: number;
  partialComponents: ScoreComponent[];
  score: ScoreResult | null;
};

function formatSplit(row: ProductRankRow) {
  const live = row.live_revenue ?? 0;
  const video = row.video_revenue ?? 0;
  const showcase = row.showcase_revenue ?? 0;
  const total = live + video + showcase;
  if (total <= 0) return null;
  return {
    live: (live / total) * 100,
    video: (video / total) * 100,
    showcase: (showcase / total) * 100,
  };
}

function toCandidate(row: ProductRankRow, profileName: string): Candidate {
  const profile = getProfile(profileName);
  const one = { unitPrice: row.unit_price ?? null, commissionRate: row.commission_rate ?? null };
  const partial = scorePhaseOne(profile, one);

  return {
    productId: row.product_id,
    name: row.product_name,
    imageUrl: row.master_image_url ?? null,
    sellerId: row.seller_id ?? null,
    sellerName: row.seller_name ?? null,
    revenue: row.revenue ?? null,
    commissionRate: row.commission_rate ?? null,
    unitPrice: row.unit_price ?? null,
    salesVolumn: row.sales_volumn ?? null,
    revenueGrowthRate: row.revenue_growth_rate ?? null,
    launchDate: row.launch_date ?? null,
    liveRevenue: row.live_revenue ?? null,
    videoRevenue: row.video_revenue ?? null,
    showcaseRevenue: row.showcase_revenue ?? null,
    formatSplit: formatSplit(row),
    partialScore: partial.total,
    partialComponents: partial.components,
    score: null,
  };
}

export type SweepOptions = {
  profileName?: string;
  categoryIds?: string[];
  dateRange?: string;
  commissionRate?: string;
  survivors?: number;
};

/** Phase one. One rank call, 100 rows, cheap criterion computed on all of them. */
export async function sweepPhaseOne(options: SweepOptions = {}): Promise<Candidate[]> {
  const profileName = options.profileName ?? "livestream";

  const rows = await productRank({
    // product/rank is capped at a 30 day window by the endpoint itself.
    dateRange: options.dateRange ?? "last7Day",
    sort: { field: "revenue", type: "DESC" },
    pageSize: 100,
    isAffiliate: 1,
    commissionRate: options.commissionRate ?? ">=15",
    categoryIds: options.categoryIds,
    needImage: 1,
    needExtra: true,
  });

  return rows
    .map((row) => toCandidate(row, profileName))
    .sort((a, b) => b.partialScore - a.partialScore || (b.revenue ?? 0) - (a.revenue ?? 0));
}

/** Phase two for a single product. Three calls. */
export async function scoreOne(candidate: Candidate, profileName = "livestream"): Promise<Candidate> {
  const profile = getProfile(profileName);

  const [long, short, creators] = await Promise.all([
    // Long window purely for the daily trend that growth and durability read.
    productDetail(candidate.productId, profile.detailDateRange),
    /*
      A second detail call at last7Day, because creator_number is scoped to the window and
      the density thresholds are calibrated for seven days. A 90 day creator count would
      be an order of magnitude larger and would score zero on everything.
    */
    productDetail(candidate.productId, "last7Day"),
    creatorRank({ productId: candidate.productId, dateRange: "last7Day" }),
  ]);

  const score = scoreFull(
    profile,
    { unitPrice: candidate.unitPrice, commissionRate: candidate.commissionRate },
    {
      revenueTrend: long?.revenue_trend ?? [],
      creatorNumber7d: short?.creator_number ?? null,
      creatorRevenues: creators.map((c) => c.revenue ?? 0).filter((n) => n > 0),
    },
  );

  return { ...candidate, score, imageUrl: candidate.imageUrl ?? long?.master_image_url ?? null };
}

/** Phase two across the survivors, sequentially so the rate limiter can pace it. */
export async function sweepPhaseTwo(
  candidates: Candidate[],
  options: SweepOptions = {},
): Promise<Candidate[]> {
  const profileName = options.profileName ?? "livestream";
  const take = candidates.slice(0, options.survivors ?? SURVIVORS);

  const scored: Candidate[] = [];
  for (const candidate of take) {
    try {
      scored.push(await scoreOne(candidate, profileName));
    } catch {
      // One product failing must not lose the other twenty four. It keeps its phase one
      // score and sorts below anything fully scored.
      scored.push(candidate);
    }
  }

  return scored.sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1));
}

/** Proven angles for a product: the videos already earning on it. */
export async function anglesFor(productId: string, dateRange = "last7Day"): Promise<VideoRankRow[]> {
  return videoRank({ productId, dateRange, pageSize: 100 });
}
