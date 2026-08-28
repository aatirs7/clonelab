import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categoryVideoCache, referenceVideos } from "@/db/schema";
import { getCategories } from "./kalodata/categories";
import { REGION, videoRank, type VideoRankRow } from "./kalodata/client";

/**
 * The creative library.
 *
 * Sweeping every category is one rank call each and the rank limit is ten per ten
 * seconds, so it cannot run on a page load. The cron refreshes the cache daily and pages
 * read whatever is stored.
 */

export type CategoryCreative = {
  categoryId: string;
  categoryName: string;
  videos: VideoRankRow[];
  aiCount: number;
  videoCount: number;
  fetchedAt: string;
};

export async function readCache(dateRange: string): Promise<CategoryCreative[]> {
  const [rows, categories] = await Promise.all([
    db
      .select()
      .from(categoryVideoCache)
      .where(and(eq(categoryVideoCache.region, REGION), eq(categoryVideoCache.dateRange, dateRange))),
    getCategories(),
  ]);

  const names = new Map(categories.map((c) => [c.categoryId, c.name]));

  return rows
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: names.get(row.categoryId) ?? row.categoryId,
      videos: row.videos as VideoRankRow[],
      aiCount: row.aiCount,
      videoCount: row.videoCount,
      fetchedAt: row.fetchedAt.toISOString(),
    }))
    // Categories where AI presenters already earn are the ones worth opening first,
    // since that is the whole question this view answers.
    .sort((a, b) => b.aiCount - a.aiCount || b.videoCount - a.videoCount);
}

/** Refreshes one category. Kept small so the cron can pace itself between calls. */
export async function refreshCategory(categoryId: string, dateRange: string): Promise<number> {
  const videos = await videoRank({ categoryIds: [categoryId], dateRange, pageSize: 100 });
  const aiCount = videos.filter((v) => v.ai_video === true).length;

  await db
    .insert(categoryVideoCache)
    .values({
      categoryId,
      dateRange,
      region: REGION,
      videos,
      aiCount,
      videoCount: videos.length,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [categoryVideoCache.region, categoryVideoCache.categoryId, categoryVideoCache.dateRange],
      set: { videos, aiCount, videoCount: videos.length, fetchedAt: new Date() },
    });

  return videos.length;
}

/* ------------------------------------------------------------------ shortlist */

export async function listReferences(runId: number) {
  return db.select().from(referenceVideos).where(eq(referenceVideos.runId, runId));
}

export async function saveReference(runId: number, video: VideoRankRow) {
  await db
    .insert(referenceVideos)
    .values({
      runId,
      videoId: video.video_id,
      title: video.video_title ?? null,
      creatorHandle: video.belonged_creator_handle ?? null,
      revenue: video.revenue ?? null,
      views: video.views ?? null,
      aiVideo: video.ai_video === true,
      ad: video.ad === true,
    })
    .onConflictDoNothing({ target: [referenceVideos.runId, referenceVideos.videoId] });
}

export async function removeReference(runId: number, videoId: string) {
  await db
    .delete(referenceVideos)
    .where(and(eq(referenceVideos.runId, runId), eq(referenceVideos.videoId, videoId)));
}
