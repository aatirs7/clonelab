import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopAdSnapshots, watchedShops } from "@/db/schema";
import { videoRank, type VideoRankRow } from "./kalodata/client";

/**
 * The ad spend detector.
 *
 * Some brands run GMV Max, which auto-boosts affiliate videos with paid spend. An
 * affiliate posting for one of those brands gets far more reach per video than the same
 * video would earn on its own. The observable signal is what share of a brand's earning
 * videos carry the ad flag.
 *
 * This is brand-level, not product-level. A brand that boosts everything is worth posting
 * for across its catalogue.
 */

export type AdProfile = {
  shopId: string;
  videoCount: number;
  adVideoCount: number;
  /** The headline. Percentage of returned videos carrying the ad flag. */
  adShare: number;
  /** Median rather than mean: one runaway ROAS should not move the reading. */
  medianAdsRoas: number | null;
  meanAdRevenueRatio: number | null;
  meanAdViewRatio: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((s, n) => s + n, 0) / values.length;
}

export function profileFromVideos(shopId: string, videos: VideoRankRow[]): AdProfile {
  const adVideos = videos.filter((v) => v.ad === true);
  const roas = adVideos.map((v) => v.ads_roas).filter((n): n is number => typeof n === "number" && n > 0);
  const revRatio = adVideos.map((v) => v.ad_revenue_ratio).filter((n): n is number => typeof n === "number");
  const viewRatio = adVideos.map((v) => v.ad_view_ratio).filter((n): n is number => typeof n === "number");

  return {
    shopId,
    videoCount: videos.length,
    adVideoCount: adVideos.length,
    adShare: videos.length === 0 ? 0 : (adVideos.length / videos.length) * 100,
    medianAdsRoas: median(roas),
    meanAdRevenueRatio: mean(revRatio),
    meanAdViewRatio: mean(viewRatio),
  };
}

/** One rank call per shop, so this is deliberately not run over an unbounded list. */
export async function profileShop(shopId: string, dateRange = "last7Day"): Promise<AdProfile> {
  const videos = await videoRank({ shopId, dateRange, pageSize: 100 });
  return profileFromVideos(shopId, videos);
}

export async function profileProduct(productId: string, dateRange = "last7Day"): Promise<AdProfile> {
  const videos = await videoRank({ productId, dateRange, pageSize: 100 });
  return profileFromVideos(productId, videos);
}

/* ------------------------------------------------------------------ watching */

export async function listWatchedShops() {
  return db.select().from(watchedShops).orderBy(desc(watchedShops.addedAt));
}

export async function watchShop(shopId: string, shopName: string | null) {
  await db
    .insert(watchedShops)
    .values({ shopId, shopName })
    .onConflictDoNothing({ target: watchedShops.shopId });
}

export async function unwatchShop(shopId: string) {
  await db.delete(watchedShops).where(eq(watchedShops.shopId, shopId));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records one day's reading for a shop. Idempotent per day, so a cron that fires twice or
 * a manual refresh does not create two rows for the same date.
 */
export async function snapshotShop(shopId: string, profile: AdProfile) {
  await db
    .insert(shopAdSnapshots)
    .values({
      shopId,
      day: today(),
      adShare: profile.adShare,
      videoCount: profile.videoCount,
      adVideoCount: profile.adVideoCount,
      medianAdsRoas: profile.medianAdsRoas,
      meanAdRevenueRatio: profile.meanAdRevenueRatio,
      meanAdViewRatio: profile.meanAdViewRatio,
    })
    .onConflictDoUpdate({
      target: [shopAdSnapshots.shopId, shopAdSnapshots.day],
      set: {
        adShare: profile.adShare,
        videoCount: profile.videoCount,
        adVideoCount: profile.adVideoCount,
        medianAdsRoas: profile.medianAdsRoas,
        meanAdRevenueRatio: profile.meanAdRevenueRatio,
        meanAdViewRatio: profile.meanAdViewRatio,
      },
    });
}

export async function shopHistory(shopId: string) {
  return db
    .select()
    .from(shopAdSnapshots)
    .where(eq(shopAdSnapshots.shopId, shopId))
    .orderBy(shopAdSnapshots.day);
}

export async function allSnapshotsFor(shopIds: string[]) {
  if (shopIds.length === 0) return [];
  const rows = await db.select().from(shopAdSnapshots).orderBy(shopAdSnapshots.day);
  return rows.filter((r) => shopIds.includes(r.shopId));
}
