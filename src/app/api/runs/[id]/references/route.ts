import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { listReferences, removeReference, saveReference } from "@/lib/creative";
import { VideoRankRow } from "@/lib/kalodata/client";

export const dynamic = "force-dynamic";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ references: await listReferences(Number((await params).id)) });
}

const body = z.union([
  z.object({ action: z.literal("save"), video: VideoRankRow }),
  z.object({ action: z.literal("remove"), videoId: z.string() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  if (parsed.data.action === "save") await saveReference(id, parsed.data.video);
  else await removeReference(id, parsed.data.videoId);

  return NextResponse.json({ references: await listReferences(id) });
}
