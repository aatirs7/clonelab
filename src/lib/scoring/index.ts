import type { ScoreComponent } from "@/db/schema";
import { livestreamProfile } from "./livestream";
import { band, type PhaseOneInput, type PhaseTwoInput, type ScoreProfile, type ScoreResult } from "./types";

export * from "./types";

/** One entry per format. A run records which one scored it. */
export const PROFILES: Record<string, ScoreProfile> = {
  livestream: livestreamProfile,
};

export const DEFAULT_PROFILE = "livestream";

export function getProfile(name: string | null | undefined): ScoreProfile {
  return PROFILES[name ?? DEFAULT_PROFILE] ?? livestreamProfile;
}

/** Phase one runs on every candidate, so it may only use fields product/rank returns. */
export function scorePhaseOne(profile: ScoreProfile, input: PhaseOneInput) {
  const components = profile.phaseOne.map((c) => {
    const { points, reason } = c.score(input);
    return { key: c.key, label: c.label, points, max: c.max, reason } satisfies ScoreComponent;
  });
  return { components, total: components.reduce((s, c) => s + c.points, 0) };
}

/** Phase two runs only on survivors, because each one costs three extra API calls. */
export function scoreFull(
  profile: ScoreProfile,
  one: PhaseOneInput,
  two: PhaseTwoInput,
): ScoreResult {
  const first = scorePhaseOne(profile, one);
  const rest = profile.phaseTwo.map((c) => {
    const { points, reason } = c.score(two);
    return { key: c.key, label: c.label, points, max: c.max, reason } satisfies ScoreComponent;
  });

  const components = [...first.components, ...rest];
  const total = components.reduce((s, c) => s + c.points, 0);
  const max = components.reduce((s, c) => s + c.max, 0);
  const hit = band(profile, total);

  return { profile: profile.name, total, max, band: hit.label, tone: hit.tone, components };
}
