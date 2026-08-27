import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { MAX_CLIP_SECONDS, MIN_CLIP_SECONDS } from "@/lib/cost";
import { uploadToFal } from "@/lib/fal";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";
// Uploading a source clip over a slow connection outlasts the default limit.
export const maxDuration = 300;

/**
 * Uploads go through here rather than straight from the browser so FAL_KEY stays on the
 * server. The file is streamed to fal storage and only the returned URL is persisted.
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

  if (!(file instanceof Blob) || (kind !== "clip" && kind !== "still" && kind !== "result")) {
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

  if (kind === "clip") {
    const seconds = Number(form?.get("seconds"));
    if (!Number.isFinite(seconds)) {
      return NextResponse.json({ error: "The clip duration could not be measured." }, { status: 400 });
    }
    // fal rejects source videos outside this window outright, so catching it here saves
    // a slow upload that was always going to fail.
    if (seconds < MIN_CLIP_SECONDS || seconds > MAX_CLIP_SECONDS) {
      return NextResponse.json(
        {
          error: `fal only accepts source clips between ${MIN_CLIP_SECONDS} and ${MAX_CLIP_SECONDS} seconds. This one is ${seconds.toFixed(1)}s.`,
        },
        { status: 400 },
      );
    }

    try {
      const url = await uploadToFal(file);
      await updateRun(id, {
        sourceClipUrl: url,
        sourceClipSeconds: seconds,
        status: run.status === "draft" || run.status === "planned" ? "filmed" : run.status,
      });
      return NextResponse.json({ url, seconds });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 502 });
    }
  }

  try {
    const url = await uploadToFal(file);
    await updateRun(id, {
      characterStillUrl: url,
      status: run.sourceClipUrl ? "still_ready" : run.status,
    });
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
