import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { categoryRank, REGION } from "./client";

/**
 * The category id to name map.
 *
 * Rank endpoints filter by category_ids but never return a category name, so without this
 * every product and video would be labelled by an opaque numeric id. The list barely
 * changes, so it is fetched once and cached in Postgres rather than on every page load.
 */

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type Category = { categoryId: string; name: string };

async function cached(region: string): Promise<{ rows: Category[]; freshestAt: Date | null }> {
  const rows = await db.select().from(categories).where(eq(categories.region, region));
  const freshestAt = rows.reduce<Date | null>(
    (latest, r) => (latest === null || r.updatedAt > latest ? r.updatedAt : latest),
    null,
  );
  return { rows: rows.map((r) => ({ categoryId: r.categoryId, name: r.name })), freshestAt };
}

/**
 * Returns the map, refreshing it only when it is missing or a day old.
 *
 * The refresh is self-gating on the cache timestamp, so a burst of page loads triggers at
 * most one sweep. `force` exists for the scheduled refresh.
 */
export async function getCategories(force = false): Promise<Category[]> {
  const region = REGION;
  const { rows, freshestAt } = await cached(region);

  const stale = freshestAt === null || Date.now() - freshestAt.getTime() > STALE_AFTER_MS;
  if (!force && !stale && rows.length > 0) return rows;

  let fetched;
  try {
    fetched = await categoryRank();
  } catch {
    // A failed refresh must not empty a cache that still works. Stale names are far
    // better than every category suddenly rendering as a bare id.
    if (rows.length > 0) return rows;
    throw new Error("Could not load categories and nothing is cached");
  }

  const values = fetched
    .filter((c) => c.category_name)
    .map((c) => ({
      categoryId: c.category_id,
      name: c.category_name as string,
      region,
      updatedAt: new Date(),
    }));

  if (values.length === 0) return rows;

  await db
    .insert(categories)
    .values(values)
    .onConflictDoUpdate({
      target: [categories.region, categories.categoryId],
      set: { name: sqlExcluded("name"), updatedAt: new Date() },
    });

  return values.map((v) => ({ categoryId: v.categoryId, name: v.name }));
}

/** Small helper so the upsert reads clearly without importing the sql tag everywhere. */
import { sql } from "drizzle-orm";
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

export async function categoryNameMap(): Promise<Map<string, string>> {
  const rows = await getCategories();
  return new Map(rows.map((r) => [r.categoryId, r.name]));
}
