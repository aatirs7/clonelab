import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";
import { ElevenLabsError, listVoices, suggestVoice } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

/** The voice list, plus a suggestion matched to the cast character when one is given. */
export async function GET(request: Request) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const age = Number(url.searchParams.get("age"));
  const gender = url.searchParams.get("gender") ?? "";

  try {
    const voices = await listVoices();
    const suggested =
      Number.isFinite(age) && gender ? suggestVoice(voices, { age, gender }) : null;
    return NextResponse.json({ voices, suggestedVoiceId: suggested?.voiceId ?? null });
  } catch (error) {
    const status = error instanceof ElevenLabsError ? error.status : 502;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
