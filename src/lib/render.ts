/**
 * Which way a render actually happens.
 *
 * On the Higgsfield Plus subscription the model runs inside a flat monthly window, so
 * per-render billing goes to zero and the operator drives the render by hand: copy the
 * prompt and the two input URLs, generate on higgsfield.ai, bring the MP4 back.
 *
 * The fal path is not deleted, only switched off. Higgsfield has a real API at
 * cloud.higgsfield.ai, and if the consumer subscription credits turn out to work against
 * it, step seven goes back to being automated and this flag is the only thing that moves.
 */
export type RenderProvider = "manual" | "fal";

export function renderProvider(): RenderProvider {
  return process.env.RENDER_PROVIDER === "fal" ? "fal" : "manual";
}

export const HIGGSFIELD_URL = "https://higgsfield.ai";
