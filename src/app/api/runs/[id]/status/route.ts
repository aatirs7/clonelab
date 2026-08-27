import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { checkRender } from "@/lib/fal";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

/**
 * Polled every five seconds by the run page while a render is in flight. Reference
 * renders with a video input are the slowest of the three Seedance endpoints, so this
 * runs for minutes and the terminal result is written back here rather than being held
 * in client state, which is what makes a refresh safe.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!run.falRequestId) {
    return NextResponse.json({ status: run.status, resultUrl: run.resultUrl });
  }
  if (run.status === "complete" || run.status === "failed") {
    return NextResponse.json({ status: run.status, resultUrl: run.resultUrl, error: run.falError });
  }

  try {
    const state = await checkRender(run.falRequestId);

    if (state.state === "pending") {
      return NextResponse.json({ status: "rendering", queuePosition: state.queuePosition });
    }

    if (state.state === "failed") {
      await updateRun(id, { status: "failed", falError: state.message });
      return NextResponse.json({ status: "failed", error: state.message });
    }

    await updateRun(id, { status: "complete", resultUrl: state.videoUrl });
    return NextResponse.json({ status: "complete", resultUrl: state.videoUrl });
  } catch (error) {
    // A transient status check failure is not a failed render. Report it and let the
    // next poll try again rather than marking a job dead that is still running.
    return NextResponse.json({ status: run.status, error: (error as Error).message });
  }
}
