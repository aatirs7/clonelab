import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { categoryNameMap } from "@/lib/kalodata/categories";
import { KalodataError } from "@/lib/kalodata/client";
import { sweepPhaseOne } from "@/lib/picker";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const body = z.object({
  categoryIds: z.array(z.string()).optional(),
  dateRange: z.string().optional(),
  commissionRate: z.string().optional(),
  profileName: z.string().optional(),
});

/** Phase one. One rank call, so this is cheap enough to run on demand. */
export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const [candidates, names] = await Promise.all([sweepPhaseOne(parsed.data), categoryNameMap()]);
    return NextResponse.json({
      candidates,
      categories: [...names.entries()].map(([id, name]) => ({ id, name })),
    });
  } catch (error) {
    if (error instanceof KalodataError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
