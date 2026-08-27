/**
 * Seedance reference-to-video billing.
 *
 * Reference renders bill the INPUT video duration alongside the output, which is why
 * trimming the source clip before upload matters. Uploading a 40 second file to render
 * 10 seconds of it roughly doubles the bill and nothing in the UI would otherwise say so.
 *
 * From the fal model page:
 *   tokens = (output_height * output_width * (input_duration + output_duration) * 24) / 1024
 *   cost   = tokens / 1000 * 0.0214, multiplied by 0.6 when a video reference is present
 *
 * Known discrepancy, deliberately not smoothed over: the same fal page also quotes
 * "~$0.2838 / second" at 720p with video references, which does not reconcile with its
 * own formula, and the build spec's prose says a 10 second 720p attempt is ~$4.50. Three
 * numbers. We implement the published formula because it is the only one that is
 * actually specified, we label every output an estimate, and we record what fal really
 * billed on the run so the first live render settles it.
 */

export type Resolution = "480p" | "720p" | "1080p";

const PRICE_PER_1K_TOKENS = 0.0214;
const VIDEO_REFERENCE_MULTIPLIER = 0.6;

/**
 * Vertical 9:16 frame sizes. The short side names the tier, so 480p vertical is
 * 480 wide by 854 tall, not the other way round.
 */
const DIMENSIONS: Record<Resolution, { width: number; height: number }> = {
  "480p": { width: 480, height: 854 },
  "720p": { width: 720, height: 1280 },
  "1080p": { width: 1080, height: 1920 },
};

export type CostInput = {
  resolution: Resolution;
  /** Output duration in seconds. */
  seconds: number;
  /** Measured duration of the uploaded source clip, also billed. */
  inputSeconds: number;
  hasVideoReference: boolean;
};

export function estimateTokens(input: CostInput): number {
  const { width, height } = DIMENSIONS[input.resolution];
  const billedSeconds = input.inputSeconds + input.seconds;
  return (height * width * billedSeconds * 24) / 1024;
}

/** Estimated cost in whole cents, rounded up so an estimate never reads low. */
export function estimateCents(input: CostInput): number {
  const tokens = estimateTokens(input);
  const multiplier = input.hasVideoReference ? VIDEO_REFERENCE_MULTIPLIER : 1;
  const dollars = (tokens / 1000) * PRICE_PER_1K_TOKENS * multiplier;
  return Math.ceil(dollars * 100);
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "not known yet";
  return `$${(cents / 100).toFixed(2)}`;
}

/** fal rejects source videos outside this window outright, so it is a hard gate. */
export const MIN_CLIP_SECONDS = 1.8;
export const MAX_CLIP_SECONDS = 30.2;

/** Spec rule: total runtime between 8 and 15 seconds. */
export const MIN_RUN_SECONDS = 8;
export const MAX_RUN_SECONDS = 15;
