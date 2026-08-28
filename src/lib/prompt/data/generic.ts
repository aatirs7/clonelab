import type { CastingBucket } from "../types";

/**
 * The floor. Used only when nothing more specific exists, and as the base for a custom
 * identifier.
 *
 * Note the realism list carries no phrase that the character template's fixed preamble
 * already states. The preamble says "visible pores, natural skin variation, individual
 * hair strands", so a realism option repeating any of those would make roughly half of
 * all rolls emit the same phrase twice in one sentence.
 */
export const genericBucket: CastingBucket = {
  label: "Custom Identifier",
  noun: "person",
  body: [
    { text: "average realistic build", weight: 28 },
    { text: "slim natural build", weight: 16 },
    { text: "sturdy practical build", weight: 16 },
    { text: "softer rounded build", weight: 14 },
    { text: "tall lean build", weight: 12 },
    { text: "compact solid build", weight: 8 },
  ],
  face: [
    { text: "balanced natural facial features", weight: 24 },
    { text: "softer rounded face", weight: 18 },
    { text: "narrow face with a gentle jawline", weight: 16 },
    { text: "broad friendly face", weight: 16 },
    { text: "angular face with defined cheekbones", weight: 14 },
    { text: "ordinary approachable face", weight: 12 },
  ],
  hair: [
    { text: "short brown hair", weight: 18 },
    { text: "short black hair", weight: 16 },
    { text: "medium-length brown hair", weight: 14 },
    { text: "short dark buzzcut", weight: 12 },
    { text: "messy short hair", weight: 12 },
    { text: "shoulder-length dark hair", weight: 10 },
    { text: "salt-and-pepper short hair", weight: 10 },
    { text: "shaved head", weight: 8 },
  ],
  eyes: [
    { text: "brown eyes", weight: 32 },
    { text: "blue eyes", weight: 20 },
    { text: "hazel eyes", weight: 20 },
    { text: "green eyes", weight: 12 },
    { text: "dark brown eyes", weight: 8 },
    { text: "blue-gray eyes", weight: 8 },
  ],
  skin: [
    { text: "believable human skin texture", weight: 30 },
    { text: "natural skin texture with visible pores", weight: 24 },
    { text: "even natural skin tone", weight: 20 },
    { text: "lightly weathered natural skin", weight: 14 },
    { text: "subtle everyday skin variation", weight: 12 },
  ],
  outfit: [
    { text: "clean casual outfit with realistic fabric folds", weight: 20 },
    { text: "simple fitted workwear with natural fabric texture", weight: 18 },
    { text: "plain everyday top with practical pants", weight: 18 },
    { text: "layered casual outfit with believable wrinkles", weight: 16 },
    { text: "neutral studio-friendly outfit with soft fabric drape", weight: 14 },
    { text: "relaxed everyday outfit with worn cotton texture", weight: 14 },
  ],
  realism: [
    { text: "authentic shadows and natural facial asymmetry", weight: 25 },
    { text: "realistic teeth and believable clothing folds", weight: 25 },
    { text: "clean studio lighting response across the whole subject", weight: 25 },
    { text: "consistent depth of field with a naturally sharp face", weight: 25 },
  ],
};

/**
 * The realism list is identical across every bucket by design: it exists for variety of
 * phrasing, not for rarity, so all four options sit flat at 25.
 */
export const sharedRealism = genericBucket.realism!;
