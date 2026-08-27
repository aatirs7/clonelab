import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { createRun } from "@/lib/runs";
import { createProduct, getProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

/*
  A run is started either against a product already in the table (picked through the
  Kalodata picker) or against a name typed by hand, which creates a bare product record.
  Either way the run ends up pointing at a product rather than carrying its own copy.
*/
const body = z.object({
  productId: z.number().int().optional(),
  productName: z.string().min(1).optional(),
  productCategory: z.string().default(""),
  hookAngle: z.string().default(""),
  hasSample: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { productId, productName, productCategory, hookAngle, hasSample } = parsed.data;

  let resolvedId = productId;
  if (resolvedId === undefined) {
    if (!productName) {
      return NextResponse.json({ error: "a product id or a product name is required" }, { status: 400 });
    }
    const product = await createProduct({
      name: productName,
      categoryName: productCategory || null,
      hasSample,
    });
    resolvedId = product.id;
  } else if (!(await getProduct(resolvedId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const run = await createRun({ productId: resolvedId, hookAngle });
  return NextResponse.json({ id: run.id });
}
