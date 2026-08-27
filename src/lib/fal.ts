import "server-only";
import { fal } from "@fal-ai/client";
import { ApiError } from "@fal-ai/client";

/**
 * Server side only. FAL_KEY never reaches the browser, which is also why uploads are
 * proxied through our own route handlers rather than done directly from the client.
 */

export const SEEDANCE_ENDPOINT = "bytedance/seedance-2.5/reference-to-video";

let configured = false;
function client() {
  if (!configured) {
    const credentials = process.env.FAL_KEY;
    if (!credentials) {
      throw new Error("FAL_KEY is not set");
    }
    fal.config({ credentials });
    configured = true;
  }
  return fal;
}

export async function uploadToFal(file: Blob): Promise<string> {
  return client().storage.upload(file);
}

export type SubmitRenderInput = {
  prompt: string;
  sourceClipUrl: string;
  characterStillUrl: string;
  seconds: number;
  resolution: "480p" | "720p" | "1080p";
};

export async function submitRender(input: SubmitRenderInput): Promise<string> {
  const queued = await client().queue.submit(SEEDANCE_ENDPOINT, {
    input: {
      prompt: input.prompt,
      video_urls: [input.sourceClipUrl],
      image_urls: [input.characterStillUrl],
      duration: String(input.seconds),
      resolution: input.resolution,
      aspect_ratio: "9:16",
      // The model's own audio would replace the operator's real voice with a synthetic
      // one, which throws away the entire reason this looks better than text to video.
      // The original track is relayed over the render in CapCut instead.
      generate_audio: false,
    },
  });
  return queued.request_id;
}

export type RenderState =
  | { state: "pending"; queuePosition: number | null }
  | { state: "complete"; videoUrl: string }
  | { state: "failed"; message: string };

/**
 * The queue exposes IN_QUEUE, IN_PROGRESS and COMPLETED, with no FAILED. A render that
 * errored still reports COMPLETED, and the failure only surfaces when you ask for the
 * result and it throws. So the result call is where failure is actually detected.
 */
export async function checkRender(requestId: string): Promise<RenderState> {
  const fal = client();

  const status = await fal.queue.status(SEEDANCE_ENDPOINT, { requestId });
  if (status.status !== "COMPLETED") {
    return {
      state: "pending",
      queuePosition: status.status === "IN_QUEUE" ? status.queue_position : null,
    };
  }

  try {
    const result = await fal.queue.result(SEEDANCE_ENDPOINT, { requestId });
    const videoUrl = (result.data as { video?: { url?: string } })?.video?.url;
    if (!videoUrl) {
      return { state: "failed", message: "The render finished but returned no video." };
    }
    return { state: "complete", videoUrl };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = error.body as { detail?: unknown } | undefined;
      const detail = typeof body?.detail === "string" ? body.detail : error.message;
      return { state: "failed", message: detail };
    }
    return { state: "failed", message: (error as Error).message };
  }
}
