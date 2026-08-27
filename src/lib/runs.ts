import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, runs, type NewRun, type Product, type Run } from "@/db/schema";

/**
 * A run with its product attached. The product carries the name, category and whether a
 * sample is on hand; the run carries the angle. Almost everything that touches a run
 * needs both, so joining once here beats every call site doing its own lookup.
 */
export type RunWithProduct = Run & { product: Product };

function join(row: { runs: Run; products: Product }): RunWithProduct {
  return { ...row.runs, product: row.products };
}

export async function listRuns(): Promise<RunWithProduct[]> {
  const rows = await db
    .select()
    .from(runs)
    .innerJoin(products, eq(runs.productId, products.id))
    .orderBy(desc(runs.createdAt));
  return rows.map(join);
}

export async function getRun(id: number): Promise<RunWithProduct | null> {
  if (!Number.isFinite(id)) return null;
  const [row] = await db
    .select()
    .from(runs)
    .innerJoin(products, eq(runs.productId, products.id))
    .where(eq(runs.id, id))
    .limit(1);
  return row ? join(row) : null;
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
