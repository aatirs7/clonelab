import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { readCache, refreshCategory } from "@/lib/creative";
import { KalodataError } from "@/lib/kalodata/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Reads the cache the cron fills. No Kalodata calls, so this is free and instant. */
export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dateRange = new URL(request.url).searchParams.get("dateRange") ?? "last7Day";
  return NextResponse.json({ categories: await readCache(dateRange) });
}

const body = z.object({ categoryId: z.string(), dateRange: z.string().default("last7Day") });

/** Refreshes one category on demand, for when the cached day is not good enough. */
export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const count = await refreshCategory(parsed.data.categoryId, parsed.data.dateRange);
    return NextResponse.json({ ok: true, videos: count });
  } catch (error) {
    const status = error instanceof KalodataError ? 502 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
