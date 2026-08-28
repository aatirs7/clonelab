import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/auth";
import { deleteRun, getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

const patch = z.object({
  prompt: z.string().optional(),
  promptEdited: z.boolean().optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  seconds: z.number().int().min(4).max(30).optional(),
  status: z
    .enum(["draft", "planned", "filmed", "still_ready", "queued", "rendering", "complete", "failed"])
    .optional(),
  posted: z.boolean().optional(),
  // Read off the fal dashboard by hand. The queue API does not report what a request
  // was billed, and the published formula has three conflicting figures attached to it,
  // so the only way the estimator ever gets calibrated is the operator typing in the
  // real number once.
  actualCost: z.number().int().min(0).nullable().optional(),
  commissionEarned: z.number().int().min(0).nullable().optional(),
  // Prompt generator state. The roll is stored alongside the rendered string: the roll
  // allows replay from the seed, the string is the record of what was actually pasted.
  characterSeed: z.string().nullable().optional(),
  characterRoll: z.record(z.string(), z.unknown()).nullable().optional(),
  characterPrompt: z.string().nullable().optional(),
  renderPromptMode: z.string().nullable().optional(),
  renderPromptStrictness: z.string().nullable().optional(),
  renderPromptExtra: z.string().nullable().optional(),
  renderPrompt: z.string().nullable().optional(),
  finishChecks: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const values: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.posted === true) values.postedAt = new Date();
  // An empty prompt is the reset control, not a prompt of zero length. Storing null is
  // what lets the page fall back to recomposing it from the character and the beats.
  if (parsed.data.prompt === "") values.prompt = null;

  const run = await updateRun(id, values);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  await deleteRun(id);
  return NextResponse.json({ ok: true });
}
