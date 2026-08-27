import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { KalodataError } from "@/lib/kalodata/client";
import { scoreOne, type Candidate } from "@/lib/picker";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const body = z.object({
  candidate: z.object({}).passthrough(),
  profileName: z.string().optional(),
});

/**
 * Phase two for one candidate. Three Kalodata calls, so roughly three cents each time.
 *
 * Scoring one at a time rather than all the survivors at once keeps the panel responsive
 * and lets the operator stop paying the moment they have seen enough.
 */
export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const scored = await scoreOne(
      parsed.data.candidate as unknown as Candidate,
      parsed.data.profileName,
    );
    return NextResponse.json({ candidate: scored });
  } catch (error) {
    if (error instanceof KalodataError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
