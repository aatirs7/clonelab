import { genericBucket } from "./data/generic";
import { genderPools } from "./data/gender-pools";
import { professionBuckets } from "./data/professions";
import { createRng, makeSeed, weightedPick } from "./random";
import type { AttributeKey, AttributeTable, CastingBucket, CharacterRoll, Gender, WeightedOption } from "./types";

export function getBucket(professionKey: string, customNoun: string): CastingBucket {
  if (professionKey === "custom") {
    const noun = customNoun.trim() || "person";
    return { ...genericBucket, label: noun, noun, custom: true };
  }
  return professionBuckets[professionKey] || professionBuckets.construction;
}

/**
 * Three layer merge: bucket, then gender pool, then generic. Stops at the first hit.
 *
 * The two special cases are what let one set of twenty profession tables cover both
 * genders. Profession hair lists are written male-first, so a female roll takes the
 * female pool before ever touching the bucket's own hair, and never inherits "shaved
 * head" from a construction table. A custom identifier has no profession wardrobe of its
 * own, so its outfit comes from the gender pool rather than the generic floor.
 */
export function resolveAttributeItems(
  bucket: CastingBucket,
  key: AttributeKey,
  gender: Gender,
): WeightedOption[] {
  const genderKey = `${gender}${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof CastingBucket;
  const override = bucket[genderKey] as WeightedOption[] | undefined;
  if (override) {
    return override;
  }
  if (key === "hair" && gender === "female") {
    return genderPools.female.hair;
  }
  if (key === "outfit" && bucket.custom) {
    return genderPools[gender].outfit;
  }
  return (
    (bucket[key] as WeightedOption[] | undefined) ||
    (genderPools[gender] as unknown as Partial<AttributeTable>)[key] ||
    genericBucket[key]!
  );
}

/**
 * Fixed order, and the rng is shared across the whole roll, so the same seed plus the
 * same inputs always yields the same character. Reordering this array changes every
 * historical roll and has to be treated as a data migration, not a tidy-up.
 */
export const ATTRIBUTE_KEYS: AttributeKey[] = [
  "body",
  "face",
  "hair",
  "eyes",
  "skin",
  "outfit",
  "realism",
];

/**
 * Clamped to 19 to 85, defaulting to 24.
 *
 * This is not cosmetic. It is the guard that stops the tool ever describing a minor, so
 * it lives in the roll function rather than only on the input element, where a pasted
 * value or a direct API call would bypass it.
 */
export function clampAge(input: string | number): number {
  const parsed = typeof input === "number" ? input : Number.parseInt(input, 10);
  if (Number.isNaN(parsed)) {
    return 24;
  }
  return Math.max(19, Math.min(85, parsed));
}

export function rollCharacter(input: {
  seed?: string;
  age: string | number;
  gender: Gender;
  professionKey: string;
  customNoun: string;
}): CharacterRoll {
  const seed = input.seed || makeSeed();
  const rng = createRng(seed);
  const bucket = getBucket(input.professionKey, input.customNoun);
  const gender = input.gender === "female" ? "female" : "male";

  const picked = Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, weightedPick(resolveAttributeItems(bucket, key, gender), rng)]),
  ) as Record<AttributeKey, string>;

  return {
    seed,
    age: clampAge(input.age),
    gender,
    genderLabel: genderPools[gender].label,
    noun: bucket.noun,
    ...picked,
  };
}
