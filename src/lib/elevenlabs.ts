import "server-only";
import { z } from "zod";

/**
 * ElevenLabs speech-to-speech, deliberately NOT text-to-speech.
 *
 * The operator's own take drives the lip motion in the render. Seedance copies mouth and
 * jaw movement frame for frame off the source clip, so the audio laid back over it has to
 * keep the operator's exact timing and delivery. Text-to-speech would generate its own
 * timing from a script and drift out of sync within a sentence, which is the one thing
 * this whole pipeline is built to avoid.
 *
 * Speech-to-speech converts timbre while preserving performance: same words, same pauses,
 * same emphasis, different voice.
 */

const BASE = "https://api.elevenlabs.io/v1";

function key(): string {
  const value = process.env.ELEVENLABS_API_KEY;
  if (!value) throw new Error("ELEVENLABS_API_KEY is not set");
  return value;
}

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

/**
 * Labels are free-form and vary between voices, so every field is optional. Reading
 * `labels.gender` as guaranteed would throw on any voice that happens not to carry it.
 */
const VoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string().nullish(),
  category: z.string().nullish(),
  preview_url: z.string().nullish(),
  labels: z.record(z.string(), z.string()).nullish(),
});

const VoicesResponse = z.object({ voices: z.array(VoiceSchema) });

export type Voice = {
  voiceId: string;
  name: string;
  category: string | null;
  previewUrl: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  description: string | null;
};

function toVoice(raw: z.infer<typeof VoiceSchema>): Voice {
  const labels = raw.labels ?? {};
  return {
    voiceId: raw.voice_id,
    name: raw.name ?? "Unnamed",
    category: raw.category ?? null,
    previewUrl: raw.preview_url ?? null,
    gender: labels.gender ?? null,
    age: labels.age ?? null,
    accent: labels.accent ?? null,
    description: labels.description ?? labels.use_case ?? null,
  };
}

export async function listVoices(): Promise<Voice[]> {
  const response = await fetch(`${BASE}/voices`, {
    headers: { "xi-api-key": key() },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ElevenLabsError(`Could not list voices (HTTP ${response.status})`, response.status);
  }

  const parsed = VoicesResponse.safeParse(await response.json());
  if (!parsed.success) throw new ElevenLabsError("Voice list did not match the expected shape", 502);

  return parsed.data.voices.map(toVoice);
}

/**
 * Suggests the voice closest to the cast character.
 *
 * Age and gender are the two things a viewer notices instantly when they disagree with
 * the face, so they are matched first and everything else is a tiebreak. This is a
 * starting point, not a decision: the operator previews and picks.
 */
export function suggestVoice(voices: Voice[], character: { age: number; gender: string }): Voice | null {
  if (voices.length === 0) return null;

  const wantedGender = character.gender.trim().toLowerCase();
  // ElevenLabs age labels are coarse buckets rather than numbers.
  const wantedAge = character.age < 30 ? "young" : character.age < 55 ? "middle aged" : "old";

  const scored = voices.map((voice) => {
    let score = 0;
    const gender = voice.gender?.toLowerCase() ?? "";
    const age = voice.age?.toLowerCase() ?? "";
    if (gender && wantedGender && gender === wantedGender) score += 2;
    if (age && age === wantedAge) score += 2;
    // A partial age match still beats nothing: "middle aged" against "old" is closer
    // than a voice carrying no age label at all.
    else if (age && wantedAge.split(" ").some((w) => age.includes(w))) score += 1;
    return { voice, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].voice : voices[0];
}

export type ConvertInput = {
  voiceId: string;
  audio: Blob;
  filename?: string;
  removeBackgroundNoise?: boolean;
};

/**
 * Converts a recorded take into the target voice, preserving timing.
 *
 * Returns the audio bytes rather than a URL because ElevenLabs streams the file back
 * directly; the caller decides where it lives.
 */
export async function convertSpeech(input: ConvertInput): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const form = new FormData();
  form.set("audio", input.audio, input.filename ?? "take.mp3");
  // eleven_multilingual_sts_v2 is the current speech-to-speech model. The text-to-speech
  // models are not valid on this endpoint.
  form.set("model_id", "eleven_multilingual_sts_v2");
  form.set("output_format", "mp3_44100_192");
  if (input.removeBackgroundNoise) form.set("remove_background_noise", "true");

  const response = await fetch(`${BASE}/speech-to-speech/${encodeURIComponent(input.voiceId)}`, {
    method: "POST",
    headers: { "xi-api-key": key() },
    body: form,
  });

  if (!response.ok) {
    // Their errors are JSON with a detail object; fall back to the status when it is not.
    let message = `Conversion failed (HTTP ${response.status})`;
    try {
      const body = (await response.json()) as { detail?: { message?: string } | string };
      const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
      if (detail) message = detail;
    } catch {
      /* keep the status message */
    }
    throw new ElevenLabsError(message, response.status);
  }

  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}
