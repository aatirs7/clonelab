import type { Beat, Character, Product } from "@/db/schema";

/**
 * The two prompt templates. Both are transcribed from the build spec and should stay
 * that way: they are tuned text, not something to paraphrase.
 *
 * House rule that applies to everything generated here and everywhere else in the app:
 * no em dashes, in code, copy, comments or generated prompt text.
 */

/**
 * Pasted into ChatGPT by hand. Character stills stay manual because ChatGPT holds pose
 * and hand position better than the alternatives, and it is one paste.
 */
export function characterStillPrompt(character: Character): string {
  const paragraphs: string[] = [];

  paragraphs.push(
    `Remove the person in this image and replace them with a ${character.age}-year-old adult ` +
      `${character.gender} ${character.profession}, ${character.build} build, ${character.hair}, ` +
      `mature realistic skin texture, wearing ${character.outfit} with believable seams and wear.`,
  );

  paragraphs.push(
    "Keep the exact same pose, camera angle, perspective, facial direction, body position, hand " +
      "placement and lighting as the reference image. Replace the background with a seamless soft " +
      "light-gray backdrop with subtle tonal falloff.",
  );

  // Omitted entirely when the operator has no product in frame, rather than left
  // dangling with an empty noun, which reads to the model as a real instruction.
  if (character.product.trim()) {
    paragraphs.push(
      `The subject must still be holding the exact same ${character.product}, unchanged in shape, ` +
        "color, label and position. Do not restyle, relabel or substitute it.",
    );
  }

  paragraphs.push(
    "Prioritize extreme photorealism: visible pores, natural skin variation, individual hair " +
      "strands, realistic eyes and teeth, subtle facial asymmetry, accurate anatomy, and natural " +
      "clothing folds. No smoothing, no beauty retouching, no stylization.",
  );

  return paragraphs.join("\n\n");
}

const JOIN = "\n\n";

function formatSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Renders the beat sheet back out as timestamp prose. Seedance reads timestamp phrasing,
 * and restating motion the model can already see in the reference video raises adherence.
 */
export function beatsAsTimestamps(beats: Beat[]): string {
  return beats
    .map((beat) => {
      const action = beat.action.trim().replace(/\.$/, "");
      const lowered = action.charAt(0).toLowerCase() + action.slice(1);
      return `At ${formatSeconds(beat.at)} seconds the subject ${lowered}.`;
    })
    .join(" ");
}

export const COMPOSITE_INSTRUCTION =
  "You do not have this product in hand, so the still is a composite. Paste BOTH images into " +
  "ChatGPT: your frame grab first, then the product photo. The model puts the real product into " +
  "the grip your hands already made.";

export const NO_SAMPLE_FILMING_NOTE =
  "You do not have this product in hand. Hold something roughly its size and shape while you " +
  "film. An empty hand, or a stand-in of the wrong size, gives a grip the composite cannot be " +
  "fitted into afterwards.";

/** The Seedance edit prompt, composed from the character block and the beat sheet. */
export function editPrompt(character: Character, beats: Beat[], productName?: string): string {
  const paragraphs: string[] = [];

  paragraphs.push(
    "Replace the person in [Video1] with the character shown in [Image1]. Hold the original " +
      "motion strictly one to one: identical body movement, hand gestures, head turns, mouth and " +
      "jaw movement, blink timing, camera framing and pacing. Nothing speeds up, slows down or " +
      "re-times.",
  );

  if (beats.length) {
    paragraphs.push(beatsAsTimestamps(beats));
  }

  // Named explicitly so the model has something concrete to hold constant. A generic
  // "product" is much weaker instruction than the actual thing.
  const product = character.product.trim() || productName?.trim() || "product";
  paragraphs.push(
    `The ${product} stays exactly as it appears in [Video1] and [Image1], identical in shape, ` +
      "color, label, text and proportions, with the same angle and grip in every single frame. " +
      "Do not restyle it, relabel it, resize it or substitute it at any point. Keep the original " +
      "room, background, props and lighting from [Video1] unchanged. Match the face, hair, build " +
      "and clothing to [Image1] in every frame, with photorealistic skin texture and no " +
      "stylization.",
  );

  return paragraphs.join("\n\n");
}

/**
 * The no-sample variant. Two references instead of one: the operator's own frame grab and
 * a real photograph of the real product.
 *
 * The product is composited, never invented. A model asked to generate a product from a
 * text description produces something that looks plausible and is not the thing being
 * sold, with the wrong label and the wrong proportions, which is worse than useless for
 * an affiliate video.
 */
export function compositeStillPrompt(character: Character, product: Product): string {
  const paragraphs: string[] = [];

  const named = product.name.trim();
  paragraphs.push(
    "Use two reference images. [Image1] is the source frame. [Image2] is a photograph of the " +
      `real product, ${named}.`,
  );

  paragraphs.push(
    `In [Image1], remove the person and replace them with a ${character.age}-year-old adult ` +
      `${character.gender} ${character.profession}, ${character.build} build, ${character.hair}, ` +
      `mature realistic skin texture, wearing ${character.outfit} with believable seams and wear.`,
  );

  paragraphs.push(
    "Keep the exact same pose, camera angle, perspective, facial direction, body position, hand " +
      "placement and lighting as [Image1]. Replace the background with a seamless soft light-gray " +
      "backdrop with subtle tonal falloff.",
  );

  paragraphs.push(
    `Composite the exact ${named} shown in [Image2] into the subject's hands, in the grip and at ` +
      `the angle their hands already hold in [Image1]. Reproduce that product unchanged in shape, ` +
      `color, label, text and proportions. Match its lighting, shadow and white balance to the ` +
      `scene. Do not redesign it, do not relabel it, do not substitute a similar product, and do ` +
      `not invent any part of it that [Image2] does not show.`,
  );

  paragraphs.push(
    "Prioritize extreme photorealism: visible pores, natural skin variation, individual hair " +
      "strands, realistic eyes and teeth, subtle facial asymmetry, accurate anatomy, and natural " +
      "clothing folds. No smoothing, no beauty retouching, no stylization.",
  );

  return paragraphs.join(JOIN);
}

/** Shown next to the copy button, because the wrong source frame wastes a whole render. */
export const STILL_INSTRUCTION =
  "Screenshot a frame where you are square to the camera with hands visible, ideally from a beat " +
  "where the product is up. A three quarter turn or a motion blur frame produces a still the " +
  "video model cannot hold onto.";
