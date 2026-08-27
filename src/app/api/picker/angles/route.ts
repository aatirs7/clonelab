import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { KalodataError } from "@/lib/kalodata/client";
import { anglesFor } from "@/lib/picker";

export const dynamic = "force-dynamic";

/** The videos already earning on a product. Proven angles, straight from the source. */
export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const dateRange = url.searchParams.get("dateRange") ?? "last7Day";
  if (!productId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const videos = await anglesFor(productId, dateRange);
    return NextResponse.json({ videos });
  } catch (error) {
    if (error instanceof KalodataError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
