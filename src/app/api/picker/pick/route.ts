import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { categoryNameMap } from "@/lib/kalodata/categories";
import { productDetail } from "@/lib/kalodata/client";
import { createProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

const componentSchema = z.object({
  key: z.string(),
  label: z.string(),
  points: z.number(),
  max: z.number(),
  reason: z.string(),
});

const body = z.object({
  candidate: z.object({
    productId: z.string(),
    name: z.string(),
    imageUrl: z.string().nullish(),
    sellerId: z.string().nullish(),
    sellerName: z.string().nullish(),
    revenue: z.number().nullish(),
    commissionRate: z.number().nullish(),
    unitPrice: z.number().nullish(),
    salesVolumn: z.number().nullish(),
    revenueGrowthRate: z.number().nullish(),
    launchDate: z.string().nullish(),
    liveRevenue: z.number().nullish(),
    videoRevenue: z.number().nullish(),
    showcaseRevenue: z.number().nullish(),
    score: z
      .object({
        profile: z.string(),
        total: z.number(),
        components: z.array(componentSchema),
      })
      .nullish(),
  }),
  dateRange: z.string().optional(),
  hasSample: z.boolean().optional(),
});

/**
 * Turns a candidate into a product record.
 *
 * Everything numeric is frozen here on purpose. Kalodata's figures move daily, so a score
 * stored without the inputs that produced it cannot be audited or explained a week later.
 * revenue_growth_rate especially: it exists only on rank, so if it is not captured during
 * the sweep it can never be recovered for that date.
 */
export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const c = parsed.data.candidate;

  // One detail call for the category ids, which rank never returns.
  let categoryId: string | null = null;
  let categoryName: string | null = null;
  try {
    const detail = await productDetail(c.productId, "last7Day");
    categoryId = detail?.ter_cate_id ?? detail?.sec_cate_id ?? detail?.pri_cate_id ?? null;
    const names = await categoryNameMap();
    categoryName =
      (categoryId ? names.get(categoryId) : null) ??
      (detail?.pri_cate_id ? names.get(detail.pri_cate_id) : null) ??
      null;
  } catch {
    // A missing category label is cosmetic and must not block the pick.
  }

  const product = await createProduct({
    kalodataProductId: c.productId,
    name: c.name,
    categoryId,
    categoryName,
    hasSample: parsed.data.hasSample ?? false,
    imageUrl: c.imageUrl ?? null,
    region: "US",
    currency: "USD",
    dateRange: parsed.data.dateRange ?? "last7Day",
    revenue: c.revenue ?? null,
    commissionRate: c.commissionRate ?? null,
    salesVolumn: c.salesVolumn ?? null,
    unitPrice: c.unitPrice ?? null,
    revenueGrowthRate: c.revenueGrowthRate ?? null,
    liveRevenue: c.liveRevenue ?? null,
    videoRevenue: c.videoRevenue ?? null,
    showcaseRevenue: c.showcaseRevenue ?? null,
    launchDate: c.launchDate ?? null,
    sellerId: c.sellerId ?? null,
    sellerName: c.sellerName ?? null,
    scoreProfile: c.score?.profile ?? null,
    scoreTotal: c.score ? Math.round(c.score.total) : null,
    scoreComponents: c.score?.components ?? null,
    scoreInputs: {
      unitPrice: c.unitPrice ?? null,
      commissionRate: c.commissionRate ?? null,
      revenue: c.revenue ?? null,
      revenueGrowthRate: c.revenueGrowthRate ?? null,
      liveRevenue: c.liveRevenue ?? null,
      videoRevenue: c.videoRevenue ?? null,
      showcaseRevenue: c.showcaseRevenue ?? null,
      sweptAt: new Date().toISOString(),
    },
    pickedAt: new Date(),
  });

  return NextResponse.json({ productId: product.id });
}
