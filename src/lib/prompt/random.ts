import type { WeightedOption } from "./types";

/**
 * Seeded randomness, deliberately not crypto.getRandomValues.
 *
 * CloneLab persists runs, so a roll has to be replayable: storing the seed with the run
 * means a character can be reproduced months later, long after the run itself has been
 * rendered and posted. Unseeded randomness would make that impossible.
 */

export function makeSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 */
export function createRng(seed: string): () => number {
  let a = hashSeed(seed);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weights are relative integers within one list and are never normalized. */
export function weightedPick(items: WeightedOption[], rng: () => number): string {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let cursor = rng() * total;
  for (const item of items) {
    cursor -= item.weight || 1;
    if (cursor <= 0) {
      return item.text;
    }
  }
  return items[items.length - 1].text;
}
