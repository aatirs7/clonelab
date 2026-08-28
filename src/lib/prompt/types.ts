/**
 * Types for the deterministic prompt generators.
 *
 * Everything under lib/prompt is pure and framework free: no React, no "use client", no
 * DOM. That is what makes it unit testable and what would let a CLI or a scheduled job
 * reuse it unchanged.
 */

export type AttributeKey = "body" | "face" | "hair" | "eyes" | "skin" | "outfit" | "realism";

export type Gender = "male" | "female";

export interface WeightedOption {
  text: string;
  weight: number;
}

export type AttributeTable = Record<AttributeKey, WeightedOption[]>;

/**
 * A casting bucket. Every key is optional except label and noun.
 * Anything missing resolves up the chain: bucket, then gender pool, then generic.
 * Gendered overrides use the pattern maleHair, femaleHair, maleOutfit, femaleOutfit.
 */
export interface CastingBucket extends Partial<AttributeTable> {
  label: string;
  noun: string;
  custom?: boolean;
  maleHair?: WeightedOption[];
  femaleHair?: WeightedOption[];
  maleOutfit?: WeightedOption[];
  femaleOutfit?: WeightedOption[];
}

export interface GenderPool {
  label: Gender;
  hair: WeightedOption[];
  outfit: WeightedOption[];
}

export interface CharacterRoll {
  seed: string;
  age: number;
  gender: Gender;
  genderLabel: Gender;
  noun: string;
  body: string;
  face: string;
  hair: string;
  eyes: string;
  skin: string;
  outfit: string;
  realism: string;
}
