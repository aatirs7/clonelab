import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { convertSpeech, ElevenLabsError } from "@/lib/elevenlabs";
import { uploadToFal } from "@/lib/fal";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";
// Converting a fifteen second take is quick, but the upload either side of it is not.
export const maxDuration = 300;

/**
 * Speech to speech, not text to speech.
 *
 * The audio posted here is the operator's own take, the same performance that drove the
 * lip motion in the render. The conversion keeps its timing exactly and changes only the
 * voice, so the returned track drops onto the video one to one with no nudging.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const voiceId = run.character?.voiceId;
  if (!voiceId) {
    return NextResponse.json(
      { error: "This character has no voice chosen yet. Pick one during casting." },
      { status: 400 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const { bytes, contentType } = await convertSpeech({
      voiceId,
      audio: file,
      filename: "take.mp3",
      // The take is filmed in a room, not a booth, and room tone survives conversion
      // otherwise and fights the original track underneath it.
      removeBackgroundNoise: true,
    });

    const url = await uploadToFal(new Blob([bytes], { type: contentType }));
    await updateRun(id, { voicedAudioUrl: url });

    return NextResponse.json({ url });
  } catch (error) {
    const status = error instanceof ElevenLabsError ? error.status : 502;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
