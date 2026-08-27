import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, type NewProduct, type Product } from "@/db/schema";

export async function listProducts(): Promise<Product[]> {
  return db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProduct(id: number): Promise<Product | null> {
  if (!Number.isFinite(id)) return null;
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

export async function createProduct(values: NewProduct): Promise<Product> {
  const [row] = await db.insert(products).values(values).returning();
  return row;
}

export async function updateProduct(id: number, values: Partial<NewProduct>): Promise<Product | null> {
  const [row] = await db
    .update(products)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return row ?? null;
}

/**
 * The photo used when compositing a product into a frame. A manual upload always wins:
 * it exists precisely because the Kalodata image was unusable or absent.
 */
export function productPhoto(product: Product): string | null {
  return product.uploadedImageUrl ?? product.imageUrl ?? null;
}
