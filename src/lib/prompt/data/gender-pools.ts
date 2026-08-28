import type { Gender, GenderPool } from "../types";

/**
 * Hair and outfit only.
 *
 * Profession hair lists are written male-first, so a female roll takes this pool instead
 * rather than inheriting "shaved head" from a construction bucket. That single fallback
 * is what lets twenty profession tables cover both genders without doubling the content.
 */
export const genderPools: Record<Gender, GenderPool> = {
  male: {
    label: "male",
    hair: [
      { text: "short brown hair", weight: 22 },
      { text: "short black hair", weight: 18 },
      { text: "short dark buzzcut", weight: 16 },
      { text: "shaved head", weight: 12 },
      { text: "messy short hair", weight: 12 },
      { text: "medium-length brown hair", weight: 10 },
      { text: "salt-and-pepper short hair", weight: 10 },
    ],
    outfit: [
      { text: "clean casual menswear with realistic fabric folds", weight: 22 },
      { text: "simple fitted tee with practical pants", weight: 20 },
      { text: "button-up shirt with casual pants", weight: 18 },
      { text: "hoodie and jeans with natural fabric texture", weight: 18 },
      { text: "plain studio-friendly outfit with masculine styling", weight: 12 },
      { text: "relaxed workwear-inspired outfit", weight: 10 },
    ],
  },
  female: {
    label: "female",
    hair: [
      { text: "long brown hair with realistic strands", weight: 18 },
      { text: "long blonde hair with natural texture", weight: 16 },
      { text: "shoulder-length brown hair", weight: 16 },
      { text: "black hair pulled into a neat ponytail", weight: 14 },
      { text: "medium-length dark hair with soft volume", weight: 12 },
      { text: "curly shoulder-length hair with natural volume", weight: 10 },
      { text: "long black hair with realistic shine", weight: 8 },
      { text: "auburn hair tied back loosely", weight: 6 },
    ],
    outfit: [
      { text: "clean casual womenswear with realistic fabric folds", weight: 22 },
      { text: "modest fitted top with casual pants", weight: 18 },
      { text: "soft sweater and jeans with natural wrinkles", weight: 18 },
      { text: "simple blouse with everyday pants", weight: 16 },
      { text: "comfortable layered outfit with feminine styling", weight: 14 },
      { text: "plain studio-friendly outfit with believable fabric texture", weight: 12 },
    ],
  },
};
