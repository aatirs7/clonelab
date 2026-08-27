import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { estimateCents } from "@/lib/cost";
import { submitRender } from "@/lib/fal";
import { editPrompt } from "@/lib/prompts";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!run.sourceClipUrl || !run.sourceClipSeconds) {
    return NextResponse.json({ error: "Upload the source clip first." }, { status: 400 });
  }
  if (!run.characterStillUrl) {
    return NextResponse.json({ error: "Upload the character still first." }, { status: 400 });
  }
  if (run.status === "queued" || run.status === "rendering") {
    return NextResponse.json({ error: "This run is already rendering." }, { status: 409 });
  }

  const prompt = run.prompt ?? (run.character && run.beats ? editPrompt(run.character, run.beats) : null);
  if (!prompt) {
    return NextResponse.json({ error: "There is no prompt to render with." }, { status: 400 });
  }

  const estimatedCost = estimateCents({
    resolution: run.resolution,
    seconds: run.seconds,
    inputSeconds: run.sourceClipSeconds,
    hasVideoReference: true,
  });

  try {
    const requestId = await submitRender({
      prompt,
      sourceClipUrl: run.sourceClipUrl,
      characterStillUrl: run.characterStillUrl,
      seconds: run.seconds,
      resolution: run.resolution,
    });

    // Persisted before the response is returned. If this write is skipped or deferred,
    // a refresh during the several minutes a render takes orphans a job we already paid
    // for, with no way to find it again.
    await updateRun(id, {
      falRequestId: requestId,
      status: "rendering",
      estimatedCost,
      prompt,
      resultUrl: null,
      falError: null,
    });

    return NextResponse.json({ requestId, estimatedCost });
  } catch (error) {
    await updateRun(id, { status: "failed", falError: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
