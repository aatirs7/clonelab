/**
 * The Seedance 2.5 edit mode prompt.
 *
 * Six blocks joined by a blank line, always in this order: what the two references are
 * and the single change, the lock list, what must stay consistent from the replacement
 * reference, the explicit do-not-touch clause, the strictness clause, and the global
 * quality and negative clause.
 *
 * The negative list and the preserve list never vary, because the failure modes of
 * Seedance edit mode are known and fixed. Randomness belongs in the character attributes
 * and nowhere near here.
 */

const JOIN = "\n\n";

export const GLOBAL_QUALITY =
  "Prioritize photorealism, natural integration, and temporal consistency. " +
  "Prevent identity drift, face warping, body morphing, clothing changes, flickering, " +
  "inconsistent hair, changing proportions, object warping, unstable edges, or " +
  "frame-to-frame appearance changes.";

export const strictnessCopy = {
  strict:
    "Preserve the reference video as closely as possible 1:1. The reference video is law. " +
    "Do not reinterpret, restage, improve, stylize, or creatively alter the original motion, " +
    "camera, composition, scene, timing, or pacing.",
  natural:
    "Preserve the reference video's timing, camera, framing, scene behavior, and primary motion. " +
    "Allow only tiny physical corrections needed to make the replacement reference fit naturally.",
  adaptive:
    "Preserve the main motion, camera, pacing, and composition from the reference video while " +
    "allowing natural fit adaptation when the replacement reference requires it.",
} as const;

export type Strictness = keyof typeof strictnessCopy;

type ModeCopy = {
  label: string;
  open: (video: string, image: string) => string;
  preserve: string;
  replace: (image: string) => string;
  only: string;
};

export const modeCopy = {
  person: {
    label: "Replace the person",
    open: (video, image) =>
      `Use ${video} as the base video and exact motion reference. Replace only the person in ${video} with the person from ${image}.`,
    preserve:
      "Preserve the original video's exact body movements, gestures, posture, head movement, facial expressions, mouth and lip movement, eye movement, timing, pacing, positioning, camera angle, camera movement, framing, perspective, environment, background, and lighting behavior as closely as possible.",
    replace: (image) =>
      `The person must maintain the face, hairstyle, body proportions, clothing, colors, and overall identity from ${image} consistently throughout the entire video.`,
    only: "Only change the person's appearance. Do not reinterpret, restage, improve, or change the original motion, camera, composition, scene, background, lighting behavior, or timing.",
  },
  clothing: {
    label: "Replace the clothing",
    open: (video, image) =>
      `Use ${video} as the exact person, motion, camera, timing, and scene reference. Replace only the clothing with the outfit from ${image}.`,
    preserve:
      "Preserve the reference video's face, hair, body proportions, skin, gestures, posture, head movement, facial expressions, timing, pacing, camera angle, camera movement, framing, perspective, environment, background, and lighting behavior.",
    replace: (image) =>
      `The new clothing must maintain the garment type, fit, fabric texture, colors, logos, and styling from ${image} consistently throughout the entire video.`,
    only: "Only replace the clothing. Do not change the person's identity, face, hair, body, motion, camera, composition, scene, background, or timing.",
  },
  product: {
    label: "Replace the product",
    open: (video, image) =>
      `Use ${video} as the exact motion, hand interaction, camera, timing, and scene reference. Replace only the product or object in the reference video with ${image}.`,
    preserve:
      "Preserve the reference video's hand movement, grip, object position, occlusion, shadows, reflections, timing, pacing, camera angle, camera movement, framing, perspective, environment, background, and lighting behavior.",
    replace: (image) =>
      `The replacement product must maintain the shape, proportions, material, label design, colors, logo placement, and overall appearance from ${image} consistently throughout the entire video.`,
    only: "Only replace the product or object. Do not change the person, hands, motion, scene, camera, background, lighting behavior, or timing.",
  },
  background: {
    label: "Replace the background",
    open: (video, image) =>
      `Use ${video} as the exact subject, motion, camera, timing, and foreground reference. Replace only the background or environment with ${image}.`,
    preserve:
      "Preserve the reference video's foreground subject identity, body movement, gestures, posture, facial expressions, mouth and lip movement, timing, pacing, positioning, camera angle, camera movement, framing, perspective, and subject scale.",
    replace: (image) =>
      `The background must maintain the environment, layout, depth, colors, lighting direction, and overall appearance from ${image} consistently throughout the entire video.`,
    only: "Only replace the background. Do not change the foreground subject, motion, camera, timing, framing, or performance.",
  },
  characterMotion: {
    label: "Character onto motion",
    open: (video, image) =>
      `Use ${image} as the character identity reference and ${video} as the exact 1:1 motion, camera, timing, and scene reference.`,
    preserve:
      "Preserve the reference video's body movements, gestures, posture, head movement, facial expressions, mouth and lip movement, eye movement, timing, pacing, positioning, camera angle, camera movement, framing, perspective, environment, background, and lighting behavior.",
    replace: (image) =>
      `The character must maintain the face, hairstyle, body proportions, clothing, colors, and overall identity from ${image} consistently throughout the entire video.`,
    only: "Transfer the character identity onto the reference motion. Do not change the motion, camera, scene, composition, background, lighting behavior, timing, or pacing.",
  },
} satisfies Record<string, ModeCopy>;

export type RenderMode = keyof typeof modeCopy;

export const DEFAULT_VIDEO_TOKEN = "@Video1";
export const DEFAULT_IMAGE_TOKEN = "@Image1";

export function buildRenderPrompt(input: {
  mode: RenderMode;
  strictness: Strictness;
  extra: string;
  /*
    Parameterized rather than hardcoded because Higgsfield numbers references by upload
    order. A run that ever attaches more than two references needs to emit @Video2.
  */
  videoToken?: string;
  imageToken?: string;
}): string {
  const video = input.videoToken || DEFAULT_VIDEO_TOKEN;
  const image = input.imageToken || DEFAULT_IMAGE_TOKEN;
  const copy = modeCopy[input.mode] || modeCopy.person;

  const sections = [
    copy.open(video, image),
    copy.preserve,
    copy.replace(image),
    copy.only,
    strictnessCopy[input.strictness] || strictnessCopy.strict,
    GLOBAL_QUALITY,
  ];

  const extra = input.extra.trim();
  if (extra) {
    // Second, immediately after the opening block, and worded as subordinate so it can
    // never be read as overriding the reference hierarchy underneath it.
    sections.splice(
      1,
      0,
      `Additional instruction: ${extra}. This is subordinate to the reference hierarchy above.`,
    );
  }

  return sections.join(JOIN);
}
