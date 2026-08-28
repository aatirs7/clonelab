import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listWatchedShops,
  profileProduct,
  profileShop,
  shopHistory,
  snapshotShop,
  unwatchShop,
  watchShop,
} from "@/lib/adspend";
import { isSignedIn } from "@/lib/auth";
import { KalodataError, shopRank } from "@/lib/kalodata/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The watch list, with each shop's recorded history. */
export async function GET() {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const shops = await listWatchedShops();
  const history = await Promise.all(
    shops.map(async (s) => ({ shopId: s.shopId, points: await shopHistory(s.shopId) })),
  );
  return NextResponse.json({ shops, history });
}

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("leaderboard"), limit: z.number().int().min(1).max(20).default(8) }),
  z.object({ action: z.literal("profileShop"), shopId: z.string(), shopName: z.string().nullish() }),
  z.object({ action: z.literal("profileProduct"), productId: z.string() }),
  z.object({ action: z.literal("watch"), shopId: z.string(), shopName: z.string().nullish() }),
  z.object({ action: z.literal("unwatch"), shopId: z.string() }),
]);

export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    switch (parsed.data.action) {
      case "leaderboard": {
        /*
          One shop/rank call for the candidates, then one video/rank per shop. That is
          limit+1 calls, so the limit is capped at twenty and defaults to eight rather
          than sweeping every shop on the platform.
        */
        const shops = await shopRank({ pageSize: parsed.data.limit });
        const rows = [];
        for (const shop of shops.slice(0, parsed.data.limit)) {
          try {
            const profile = await profileShop(shop.shop_id);
            rows.push({ ...profile, shopName: shop.shop_name ?? null, revenue: shop.revenue ?? null });
          } catch {
            // One shop failing must not lose the leaderboard.
          }
        }
        rows.sort((a, b) => b.adShare - a.adShare);
        return NextResponse.json({ rows });
      }
      case "profileShop": {
        const profile = await profileShop(parsed.data.shopId);
        // Reading it is also worth recording, so the series starts from first look.
        await snapshotShop(parsed.data.shopId, profile);
        return NextResponse.json({ profile });
      }
      case "profileProduct":
        return NextResponse.json({ profile: await profileProduct(parsed.data.productId) });
      case "watch":
        await watchShop(parsed.data.shopId, parsed.data.shopName ?? null);
        return NextResponse.json({ ok: true });
      case "unwatch":
        await unwatchShop(parsed.data.shopId);
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    const status = error instanceof KalodataError ? 502 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
