import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { uploadToFal } from "@/lib/fal";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";
// Uploading a source clip over a slow connection outlasts the default limit.
export const maxDuration = 300;

/**
 * Only outputs are hosted.
 *
 * Hosting existed because fal's render API needed publicly reachable URLs. With the render
 * a manual Higgsfield handoff the operator uploads from their own disk, so hosting the
 * source clip, the character still and the product photo bought nothing but upload
 * waiting. What is worth keeping is the artifact you come back to later: the finished MP4,
 * and the converted audio, which is written by the voice route.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");

  const kinds = ["result"];
  if (!(file instanceof Blob) || typeof kind !== "string" || !kinds.includes(kind)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // The finished MP4, brought back from Higgsfield by hand. Uploading it is what marks
  // the run complete on the manual path, since nothing polls a queue there.
  if (kind === "result") {
    try {
      const url = await uploadToFal(file);
      await updateRun(id, { resultUrl: url, status: "complete", falError: null });
      return NextResponse.json({ url });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "bad request" }, { status: 400 });
}
