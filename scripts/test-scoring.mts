/**
 * Pins the scoring engine against hand-worked cases. No API calls: the point is that the
 * rubric behaves as written, especially the trend direction, which is the one thing that
 * silently inverts every growth score if it is wrong.
 */
import assert from "node:assert/strict";
import { getProfile, scoreFull, scorePhaseOne } from "../src/lib/scoring/index";

let failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`); }
}

const p = getProfile("livestream");
console.log("scoring: livestream profile");

check("profile is selected by name, not hardcoded", () => {
  assert.equal(p.name, "livestream");
  assert.equal(getProfile("nope").name, "livestream", "unknown names fall back rather than throw");
  assert.equal(p.detailDateRange, "last90Day", "last60Day is rejected by the API with a 500");
});

check("commission_rate is percentage points, not a fraction", () => {
  // $79 at 20 percentage points is $15.80, which clears the top band.
  const r = scorePhaseOne(p, { unitPrice: 79, commissionRate: 20 });
  assert.equal(r.total, 20);
  // Dividing by 100 twice would give $0.158 and score zero, which is the bug this guards.
  const wrong = scorePhaseOne(p, { unitPrice: 79, commissionRate: 0.2 });
  assert.equal(wrong.total, 0);
});

check("commission bands", () => {
  assert.equal(scorePhaseOne(p, { unitPrice: 100, commissionRate: 20 }).total, 20); // $20.00, >=15
  assert.equal(scorePhaseOne(p, { unitPrice: 100, commissionRate: 10 }).total, 12); // $10.00, 8-15
  assert.equal(scorePhaseOne(p, { unitPrice: 50, commissionRate: 10 }).total, 5);   // $5.00, 3-8
  assert.equal(scorePhaseOne(p, { unitPrice: 10, commissionRate: 10 }).total, 0);   // $1.00, <3
});

const rising = [
  ...Array(30).fill(100),  // steady month
  ...Array(7).fill(400),   // then a sharp week
];
const declining = [
  ...Array(30).fill(400),
  ...Array(7).fill(50),
];

check("growth reads the array oldest-first", () => {
  const up = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: rising, creatorNumber7d: 5, creatorRevenues: [12000, 11000, 10000] });
  const upGrowth = up.components.find((c) => c.key === "growth")!;
  assert.equal(upGrowth.points, 20, `expected acceleration, got ${upGrowth.reason}`);

  const down = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: declining, creatorNumber7d: 5, creatorRevenues: [12000, 11000, 10000] });
  const downGrowth = down.components.find((c) => c.key === "growth")!;
  assert.equal(downGrowth.points, 0, `expected decline, got ${downGrowth.reason}`);
});

check("leading zeros before launch do not read as a dead product", () => {
  const launched = [...Array(40).fill(0), ...Array(30).fill(500)];
  const r = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: launched, creatorNumber7d: 5, creatorRevenues: [5000] });
  const dur = r.components.find((c) => c.key === "durability")!;
  assert.ok(dur.points > 0, `pre-launch zeros should be trimmed, got ${dur.reason}`);
});

check("competition density inverts: fewer creators scores higher", () => {
  const few = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: rising, creatorNumber7d: 5, creatorRevenues: [5000] });
  const many = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: rising, creatorNumber7d: 1981, creatorRevenues: [5000] });
  assert.equal(few.components.find((c) => c.key === "competition")!.points, 20);
  assert.equal(many.components.find((c) => c.key === "competition")!.points, 0);
});

check("one creator owning the revenue scores zero on distribution", () => {
  const hogged = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: rising, creatorNumber7d: 5, creatorRevenues: [9000, 500, 500] });
  assert.equal(hogged.components.find((c) => c.key === "distribution")!.points, 0);
  const spread = scoreFull(p, { unitPrice: 50, commissionRate: 20 },
    { revenueTrend: rising, creatorNumber7d: 5, creatorRevenues: [1000, 1000, 1000, 1000, 1000] });
  assert.equal(spread.components.find((c) => c.key === "distribution")!.points, 15);
});

check("six criteria, 100 points, and every one is explained", () => {
  const r = scoreFull(p, { unitPrice: 79, commissionRate: 20 },
    { revenueTrend: rising, creatorNumber7d: 5, creatorRevenues: [12000, 11000, 10000, 10000, 10000] });
  assert.equal(r.components.length, 6);
  assert.equal(r.max, 100);
  assert.equal(r.total, 100, `perfect inputs should be 100, got ${r.total}`);
  for (const c of r.components) assert.ok(c.reason.length > 0, `${c.key} has no reason`);
  assert.equal(r.band, "Strong");
});

check("bands", () => {
  const weak = scoreFull(p, { unitPrice: 5, commissionRate: 5 },
    { revenueTrend: declining, creatorNumber7d: 1981, creatorRevenues: [9000, 100] });
  assert.equal(weak.band, "Pass", `got ${weak.total} / ${weak.band}`);
});

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
