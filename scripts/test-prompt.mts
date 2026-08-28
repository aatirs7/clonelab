/**
 * Acceptance criteria 1 to 7 from the prompt generator spec, plus criterion 9's em dash
 * scan. No network, no DOM: everything under lib/prompt is pure by design.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
// Imported from the modules directly rather than through the barrel: tsx's ESM loader
// does not always resolve a chain of `export *` re-exports for runtime values.
import {
  ATTRIBUTE_KEYS,
  clampAge,
  getBucket,
  resolveAttributeItems,
  rollCharacter,
} from "../src/lib/prompt/casting";
import { genderPools } from "../src/lib/prompt/data/gender-pools";
import { professionBuckets, PROFESSION_ORDER } from "../src/lib/prompt/data/professions";
import { buildAvatarPrompt, buildCharacterPrompt } from "../src/lib/prompt/templates/character";
import { buildRenderPrompt, modeCopy, strictnessCopy } from "../src/lib/prompt/templates/render";

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n")[0]}`);
  }
}

console.log("prompt generator");

/* 1 */
check("a fixed seed and fixed inputs roll byte identical every time", () => {
  const input = {
    seed: "abc12345",
    age: 62,
    gender: "male" as const,
    professionKey: "construction",
    customNoun: "",
  };
  const a = rollCharacter(input);
  const b = rollCharacter(input);
  assert.deepEqual(a, b);
  // Pinned, so a reordering of ATTRIBUTE_KEYS or an edit to the construction tables shows
  // up here rather than silently changing every historical roll.
  assert.equal(a.seed, "abc12345");
  assert.equal(a.age, 62);
  assert.equal(a.noun, "construction worker");
  assert.equal(ATTRIBUTE_KEYS.length, 7);
});

/* 2 */
check("a female roll never takes male-pool hair, on any profession", () => {
  const malePool = new Set(genderPools.male.hair.map((h) => h.text));
  const femalePool = new Set(genderPools.female.hair.map((h) => h.text));

  for (const key of PROFESSION_ORDER) {
    for (let i = 0; i < 40; i += 1) {
      const female = rollCharacter({
        seed: `f-${key}-${i}`,
        age: 30,
        gender: "female",
        professionKey: key,
        customNoun: "",
      });
      const bucket = professionBuckets[key];
      const override = bucket.femaleHair?.map((h) => h.text);
      const allowed = override ? new Set(override) : femalePool;
      assert.ok(
        allowed.has(female.hair),
        `${key}: female roll produced "${female.hair}", which is not in its allowed hair list`,
      );
      assert.ok(
        !malePool.has(female.hair) || femalePool.has(female.hair),
        `${key}: female roll leaked male-pool hair "${female.hair}"`,
      );
    }
  }

  // And the reverse: a male roll must never take the female pool.
  for (let i = 0; i < 40; i += 1) {
    const male = rollCharacter({
      seed: `m-${i}`,
      age: 30,
      gender: "male",
      professionKey: "construction",
      customNoun: "",
    });
    const constructionHair = new Set(professionBuckets.construction.hair!.map((h) => h.text));
    assert.ok(constructionHair.has(male.hair), `male roll produced "${male.hair}"`);
  }
});

/* 3 */
check("a custom identifier uses the gender pool outfit, not the generic outfit", () => {
  const bucket = getBucket("custom", "dog groomer");
  assert.equal(bucket.noun, "dog groomer");
  assert.equal(bucket.custom, true);

  for (const gender of ["male", "female"] as const) {
    const pool = new Set(genderPools[gender].outfit.map((o) => o.text));
    const resolved = resolveAttributeItems(bucket, "outfit", gender).map((o) => o.text);
    assert.deepEqual(new Set(resolved), pool, `${gender} custom outfit did not come from the gender pool`);

    for (let i = 0; i < 25; i += 1) {
      const roll = rollCharacter({
        seed: `c-${gender}-${i}`,
        age: 40,
        gender,
        professionKey: "custom",
        customNoun: "dog groomer",
      });
      assert.ok(pool.has(roll.outfit), `custom roll outfit "${roll.outfit}" is off-pool`);
    }
  }
});

/* 4 */
check("age is clamped to 19-85 before it reaches the prompt, and says adult", () => {
  assert.equal(clampAge(12), 19);
  assert.equal(clampAge(0), 19);
  assert.equal(clampAge(-5), 19);
  assert.equal(clampAge(200), 85);
  assert.equal(clampAge("not a number"), 24);
  assert.equal(clampAge(""), 24);
  assert.equal(clampAge("62"), 62);

  // The clamp must hold in the roll function, not only on the input element.
  const young = rollCharacter({ seed: "z", age: 9, gender: "female", professionKey: "retail", customNoun: "" });
  assert.equal(young.age, 19);

  const prompt = buildCharacterPrompt(young, { sourceSubject: "woman", productInstruction: "" });
  assert.ok(prompt.includes("19-year-old adult"), "the clamped age must reach the prompt string");
  assert.ok(/\badult\b/.test(prompt), "every character prompt must contain the word adult");
});

/* 5 */
check("an empty product instruction yields two paragraphs with no blank gap", () => {
  const roll = rollCharacter({ seed: "p1", age: 30, gender: "male", professionKey: "chef", customNoun: "" });

  const without = buildCharacterPrompt(roll, { sourceSubject: "man", productInstruction: "" });
  assert.equal(without.split("\n\n").length, 2, "empty product should give exactly two paragraphs");
  assert.ok(!without.includes("\n\n\n"), "no triple newline");
  assert.ok(!/Specific product/.test(without));

  const withProduct = buildCharacterPrompt(roll, {
    sourceSubject: "man",
    productInstruction: "holding a red branded work cap",
  });
  assert.equal(withProduct.split("\n\n").length, 3);
  assert.ok(withProduct.includes("Specific product/outfit requirement:"));
});

/* 6 */
check("render prompt is six blocks, seven with an extra, and the extra is second", () => {
  const base = buildRenderPrompt({ mode: "person", strictness: "strict", extra: "" });
  assert.equal(base.split("\n\n").length, 6);

  const withExtra = buildRenderPrompt({
    mode: "person",
    strictness: "strict",
    extra: "keep the cap logo readable",
  });
  const blocks = withExtra.split("\n\n");
  assert.equal(blocks.length, 7);
  assert.ok(blocks[1].startsWith("Additional instruction:"), "the extra must be the second block");
  assert.ok(blocks[1].includes("subordinate to the reference hierarchy"));

  // Whitespace-only extras count as empty rather than producing a stray block.
  assert.equal(buildRenderPrompt({ mode: "person", strictness: "strict", extra: "   " }).split("\n\n").length, 6);
});

/* 7 */
check("all fifteen mode by strictness combinations contain both tokens", () => {
  const modes = Object.keys(modeCopy) as (keyof typeof modeCopy)[];
  const levels = Object.keys(strictnessCopy) as (keyof typeof strictnessCopy)[];
  assert.equal(modes.length, 5);
  assert.equal(levels.length, 3);

  let combos = 0;
  for (const mode of modes) {
    for (const strictness of levels) {
      const out = buildRenderPrompt({ mode, strictness, extra: "" });
      assert.ok(out.includes("@Video1"), `${mode}/${strictness} is missing @Video1`);
      assert.ok(out.includes("@Image1"), `${mode}/${strictness} is missing @Image1`);
      assert.ok(out.includes(strictnessCopy[strictness].slice(0, 40)), `${mode}/${strictness} missing strictness copy`);
      combos += 1;
    }
  }
  assert.equal(combos, 15);

  // Tokens are parameterized for the case where a run attaches more than two references.
  const renumbered = buildRenderPrompt({
    mode: "product",
    strictness: "natural",
    extra: "",
    videoToken: "@Video2",
    imageToken: "@Image3",
  });
  assert.ok(renumbered.includes("@Video2") && renumbered.includes("@Image3"));
  assert.ok(!renumbered.includes("@Video1"));
});

/* 9, the lint half */
check("no em dash anywhere in lib/prompt", () => {
  const root = path.join(process.cwd(), "src", "lib", "prompt");
  const offenders: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) {
        const text = fs.readFileSync(full, "utf8");
        text.split("\n").forEach((line, i) => {
          if (line.includes("—")) offenders.push(`${entry.name}:${i + 1}`);
        });
      }
    }
  }
  walk(root);
  assert.equal(offenders.length, 0, `em dash found at ${offenders.join(", ")}`);
});

/* Content shape, so a half-written bucket cannot ship */
check("all twenty buckets carry every slot, at the documented sizes", () => {
  assert.equal(PROFESSION_ORDER.length, 20);
  for (const key of PROFESSION_ORDER) {
    const bucket = professionBuckets[key];
    assert.ok(bucket, `${key} is missing`);
    assert.ok(bucket.label && bucket.noun, `${key} needs a label and a noun`);
    for (const slot of ATTRIBUTE_KEYS) {
      const list = bucket[slot];
      assert.ok(Array.isArray(list) && list.length >= 4, `${key}.${slot} needs at least 4 options`);
      for (const option of list!) {
        assert.ok(option.text.length > 0, `${key}.${slot} has an empty option`);
        assert.ok(option.weight > 0, `${key}.${slot} "${option.text}" needs a positive weight`);
        assert.ok(!/^(a|an|the) /i.test(option.text), `${key}.${slot} "${option.text}" has a leading article`);
        assert.ok(!option.text.endsWith("."), `${key}.${slot} "${option.text}" has a trailing period`);
        assert.ok(!option.text.includes("—"), `${key}.${slot} "${option.text}" has an em dash`);
      }
    }
    // Realism is flat by design: it is there for phrasing variety, not rarity.
    assert.equal(bucket.realism!.length, 4, `${key}.realism should hold 4 options`);
    assert.ok(bucket.realism!.every((r) => r.weight === 25), `${key}.realism weights should be flat`);
  }
});

check("no realism option repeats a phrase the fixed preamble already states", () => {
  // The preamble says these, so a realism option repeating one makes the sentence say it
  // twice. This was a live defect in the reference implementation.
  const preamble = ["visible pores", "natural skin variation", "individual hair strands", "realistic eyes"];
  for (const key of PROFESSION_ORDER) {
    for (const option of professionBuckets[key].realism!) {
      for (const phrase of preamble) {
        assert.ok(
          !option.text.toLowerCase().includes(phrase),
          `${key}.realism "${option.text}" repeats the preamble phrase "${phrase}"`,
        );
      }
    }
  }
});

check("avatar mode leaves visible placeholders when fields are blank", () => {
  const blank = buildAvatarPrompt({ referenceName: "", avatarName: "", changes: "", pronoun: "her" });
  assert.ok(blank.includes("[reference image]"));
  assert.ok(blank.includes("[image of your avatar]"));
  assert.ok(blank.includes("[describe the exact changes"));
  assert.equal(blank.split("\n\n").length, 3);

  const filled = buildAvatarPrompt({
    referenceName: "the phone shot",
    avatarName: "my avatar",
    changes: "blue eyes",
    pronoun: "him",
  });
  assert.ok(!filled.includes("["), "no placeholder should survive once every field is filled");
  assert.ok(filled.includes("Make him: blue eyes."));
});

check("no face option nests a second 'with' inside the template's own", () => {
  // The template writes "with ${face}, ...", so a face string containing "with" produced
  // "with broad rounded face with a softer jaw". Only face sits directly after that word,
  // which is why later slots keep their own with-clauses.
  const offenders: string[] = [];
  for (const key of PROFESSION_ORDER) {
    for (const option of professionBuckets[key].face!) {
      if (option.text.includes(" with ")) offenders.push(`${key}: ${option.text}`);
    }
  }
  assert.equal(offenders.length, 0, offenders.join("; "));

  /*
    Checked on the face segment only. The template legitimately writes two withs of its
    own ("replace him with a worker with ..."), so a whole-prompt scan for two withs
    flags correct English.
  */
  for (const key of PROFESSION_ORDER) {
    for (let i = 0; i < 12; i += 1) {
      const roll = rollCharacter({ seed: `g-${key}-${i}`, age: 30, gender: "male", professionKey: key, customNoun: "" });
      const prompt = buildCharacterPrompt(roll, { sourceSubject: "man", productInstruction: "" });
      const after = prompt.split(`${roll.noun} with `)[1] ?? "";
      const faceSegment = after.split(",")[0];
      assert.ok(
        !faceSegment.includes(" with "),
        `${key}: face segment reads "${faceSegment}" straight after the template's own with`,
      );
    }
  }
});

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
