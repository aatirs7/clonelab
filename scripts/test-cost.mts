/**
 * Pins the billing formula against values computed by hand. This exists because the
 * cost estimate is the main money line in the app and three different published
 * numbers disagree about it, so the one thing we can guarantee is that our code
 * matches the formula we said we were implementing.
 */
import assert from "node:assert/strict";
import { estimateCents, estimateTokens } from "../src/lib/cost";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(error as Error).message.split("\n")[0]}`);
  }
}

console.log("cost estimator");

check("720p, 10s in, 10s out, video reference", () => {
  // (1280 * 720 * 20 * 24) / 1024 = 432000 tokens
  // 432000 / 1000 * 0.0214 * 0.6 = $5.5469 -> 555 cents
  const input = {
    resolution: "720p" as const,
    seconds: 10,
    inputSeconds: 10,
    hasVideoReference: true,
  };
  assert.equal(estimateTokens(input), 432000);
  assert.equal(estimateCents(input), 555);
});

check("480p, 10s in, 10s out, video reference", () => {
  // (854 * 480 * 20 * 24) / 1024 = 192150 tokens
  // 192150 / 1000 * 0.0214 * 0.6 = $2.4672 -> 247 cents
  const input = {
    resolution: "480p" as const,
    seconds: 10,
    inputSeconds: 10,
    hasVideoReference: true,
  };
  assert.equal(estimateTokens(input), 192150);
  assert.equal(estimateCents(input), 247);
});

check("480p is materially cheaper than 720p, which is why it is the default", () => {
  const base = { seconds: 10, inputSeconds: 10, hasVideoReference: true };
  const cheap = estimateCents({ ...base, resolution: "480p" });
  const dear = estimateCents({ ...base, resolution: "720p" });
  assert.ok(dear > cheap * 2, `expected 720p to be more than double 480p, got ${dear} vs ${cheap}`);
});

check("input duration is billed, so a long source clip costs real money", () => {
  const trimmed = estimateCents({
    resolution: "480p",
    seconds: 10,
    inputSeconds: 10,
    hasVideoReference: true,
  });
  const untrimmed = estimateCents({
    resolution: "480p",
    seconds: 10,
    inputSeconds: 30,
    hasVideoReference: true,
  });
  assert.equal(untrimmed, 494);
  assert.ok(untrimmed > trimmed * 1.9, "an untrimmed clip should roughly double the bill");
});

check("the 0.6 video reference multiplier is applied", () => {
  const base = { resolution: "720p" as const, seconds: 10, inputSeconds: 10 };
  const withVideo = estimateCents({ ...base, hasVideoReference: true });
  const withoutVideo = estimateCents({ ...base, hasVideoReference: false });
  assert.equal(Math.round((withVideo / withoutVideo) * 10) / 10, 0.6);
});

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
