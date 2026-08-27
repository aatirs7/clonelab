import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { createRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

const body = z.object({
  productName: z.string().min(1),
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

  const run = await createRun(parsed.data);
  return NextResponse.json({ id: run.id });
}
