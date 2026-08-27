import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runs, type NewRun, type Run } from "@/db/schema";

export async function listRuns(): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.createdAt));
}

export async function getRun(id: number): Promise<Run | null> {
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  return row ?? null;
}

export async function createRun(values: NewRun): Promise<Run> {
  const [row] = await db.insert(runs).values(values).returning();
  return row;
}

/**
 * Every mutation goes through here so updatedAt is never forgotten. Runs are cheap and
 * most are abandoned, but the ones that are not need every step persisted the moment it
 * happens, because a render takes minutes and a refresh must not lose it.
 */
export async function updateRun(id: number, values: Partial<NewRun>): Promise<Run | null> {
  const [row] = await db
    .update(runs)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(runs.id, id))
    .returning();
  return row ?? null;
}

export async function deleteRun(id: number): Promise<void> {
  await db.delete(runs).where(eq(runs.id, id));
}
