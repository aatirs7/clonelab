import { NextResponse } from "next/server";
import { refreshCategory } from "@/lib/creative";
import { getCategories } from "@/lib/kalodata/categories";
import { listWatchedShops, profileShop, snapshotShop } from "@/lib/adspend";

export const dynamic = "force-dynamic";
// Sweeping categories is rate limited to ten rank calls per ten seconds, so this is slow
// by design rather than by accident.
export const maxDuration = 800;

/**
 * The daily refresh.
 *
 * Two jobs, both of which are rank calls and therefore too slow and too expensive to run
 * on a page load: the per-category creative cache, and one ad-share reading per watched
 * shop. The shop snapshot in particular only has value as a series, since the thing worth
 * seeing is a brand starting or stopping a spend push, which a single reading cannot show.
 *
 * Cost is bounded and worth stating: one call per category swept plus one per watched
 * shop, at 0.1 credit each.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  // Vercel sends the bearer token. An unset secret leaves this open locally, which is
  // deliberate, but in production the variable is set.
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const budgetMs = Number(process.env.CRON_BUDGET_MS ?? 700_000);
  const result = { categories: 0, videos: 0, shops: 0, errors: [] as string[], ranOut: false };

  try {
    const categories = await getCategories(true);
    // Highest revenue first, so a run that hits the time budget has still covered the
    // categories that matter most.
    for (const category of categories.slice(0, Number(process.env.CRON_CATEGORY_LIMIT ?? 25))) {
      if (Date.now() - started > budgetMs) {
        result.ranOut = true;
        break;
      }
      try {
        result.videos += await refreshCategory(category.categoryId, "last7Day");
        result.categories += 1;
      } catch (error) {
        result.errors.push(`${category.name}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    result.errors.push(`categories: ${(error as Error).message}`);
  }

  try {
    for (const shop of await listWatchedShops()) {
      if (Date.now() - started > budgetMs) {
        result.ranOut = true;
        break;
      }
      try {
        await snapshotShop(shop.shopId, await profileShop(shop.shopId));
        result.shops += 1;
      } catch (error) {
        result.errors.push(`shop ${shop.shopId}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    result.errors.push(`shops: ${(error as Error).message}`);
  }

  return NextResponse.json({ ok: true, elapsedMs: Date.now() - started, ...result });
}
