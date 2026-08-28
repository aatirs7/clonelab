import type { CharacterRoll } from "../types";

/**
 * These strings are the product. Change them deliberately, never paraphrase them
 * casually.
 *
 * The attribute order inside the character sentence is face, hair, eyes, skin, body,
 * outfit: identity first, then physique, then wardrobe. That is not the order they are
 * rolled in, and it is not alphabetical. It is the order a casting note reads.
 */

const JOIN = "\n\n";

export type SourceSubject = "man" | "woman" | "person in the reference image";

export function buildCharacterPrompt(
  roll: CharacterRoll,
  opts: { sourceSubject: SourceSubject; productInstruction: string },
): string {
  const pronoun =
    opts.sourceSubject === "man" ? "him" : opts.sourceSubject === "woman" ? "her" : "them";

  const target =
    `${roll.age}-year-old adult ${roll.genderLabel} ${roll.noun} with ` +
    `${roll.face}, ${roll.hair}, ${roll.eyes}, ${roll.skin}, ${roll.body}, and ${roll.outfit}`;

  const product = opts.productInstruction.trim();

  const sections = [
    `Remove the ${opts.sourceSubject} and replace ${pronoun} with a ${target}. ` +
      `Keep the exact same pose, camera angle, framing, perspective, facial direction, body position, ` +
      `hand placement, and lighting direction as the reference image, but replace the background with a ` +
      `seamless soft light-gray studio background with subtle tonal falloff.`,

    // Skipped entirely when empty, rather than emitted as a blank paragraph that would
    // leave a double gap in the middle of the prompt.
    product
      ? `Specific product/outfit requirement: ${product}. Keep this product or outfit detail clear, accurate, visible, and consistent with the character.`
      : "",

    `Prioritize extreme photorealism: visible pores, natural skin variation, individual hair strands, ` +
      `realistic eyes and teeth, subtle facial asymmetry, accurate anatomy, natural hands, ${roll.realism}.`,
  ].filter(Boolean);

  return sections.join(JOIN);
}

/**
 * Avatar match mode. Used when a presenter already exists and only needs adjusting, so
 * there is no roll and no table involved.
 *
 * The bracketed placeholders are deliberate. A prompt containing a visible
 * [reference image] token is obviously unfinished, which is a far better failure than one
 * that silently reads as a complete instruction while naming nothing.
 */
export function buildAvatarPrompt(input: {
  referenceName: string;
  avatarName: string;
  changes: string;
  pronoun: "her" | "him" | "them";
}): string {
  const p =
    input.pronoun === "him"
      ? { object: "him", possessive: "his" }
      : input.pronoun === "them"
        ? { object: "them", possessive: "their" }
        : { object: "her", possessive: "her" };

  const referenceName = input.referenceName.trim() || "[reference image]";
  const avatarName = input.avatarName.trim() || "[image of your avatar]";
  const changes =
    input.changes.trim() ||
    "[describe the exact changes, for example: prettier, more blonde, college girl vibe, blue eyes]";

  return [
    `Match the lighting, scale, and phone angle of ${referenceName}. The final result should make ` +
      `${avatarName} a front-facing shot on a soft light gray-white studio background with subtle tonal falloff.`,

    `Make ${p.object}: ${changes}.`,

    `Keep the same lighting on ${p.possessive} face and the same scale as ${referenceName}. ` +
      `Keep realistic, natural, and photorealistic with believable skin texture, realistic eyes and teeth, ` +
      `subtle facial asymmetry, accurate anatomy, and authentic shadows.`,
  ].join(JOIN);
}
