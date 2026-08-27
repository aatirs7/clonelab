import { NextResponse } from "next/server";
import { z } from "zod";
import type { Beat } from "@/db/schema";
import { isSignedIn } from "@/lib/auth";
import { generateBeats, productEntersAtBeat, validateBeats } from "@/lib/beats";
import { editPrompt } from "@/lib/prompts";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

const beatSchema = z.object({
  at: z.number().min(0),
  duration: z.number().positive(),
  action: z.string().min(1),
  line: z.string().nullable(),
});

const body = z.union([
  z.object({ action: z.literal("generate") }),
  z.object({ action: z.literal("save"), beats: z.array(beatSchema).min(1) }),
]);

/**
 * Recomposes the edit prompt from the character and beats, unless the operator has
 * edited it by hand. Once edited it stops regenerating, which is the whole point of the
 * promptEdited flag: an edit the operator made should never be silently overwritten by a
 * beat sheet regenerate.
 */
async function syncPrompt(id: number) {
  const run = await getRun(id);
  if (!run || run.promptEdited || !run.character || !run.beats) return;
  await updateRun(id, { prompt: editPrompt(run.character, run.beats) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  let beats: Beat[];
  if (parsed.data.action === "generate") {
    try {
      beats = await generateBeats({
        productName: run.productName,
        productCategory: run.productCategory,
        hookAngle: run.hookAngle,
        hasSample: run.hasSample,
        character: run.character,
      });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 502 });
    }
  } else {
    beats = parsed.data.beats;
  }

  const total = beats.reduce((sum, beat) => sum + beat.duration, 0);
  const issues = validateBeats(beats);
  const productBeat = productEntersAtBeat(beats, run.productName);
  if (productBeat === null || productBeat > 2) {
    issues.push("The product is not clearly in frame by beat two.");
  }

  await updateRun(id, {
    beats,
    seconds: Math.round(total),
    status: run.status === "draft" ? "planned" : run.status,
  });
  await syncPrompt(id);

  // Issues are reported, not enforced. A beat sheet that bends a rule is still a
  // usable plan, and the operator is the one who decides whether it is worth a reroll.
  return NextResponse.json({ beats, issues });
}
