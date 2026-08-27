import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Beat, Character } from "@/db/schema";
import { MAX_RUN_SECONDS, MIN_RUN_SECONDS } from "./cost";

/**
 * Beat sheet generation.
 *
 * The beat sheet is the spine of the build. It is an instruction to the operator,
 * produced BEFORE filming, not an instruction to the model produced after. Seedance in
 * edit mode copies motion out of the source clip and cannot invent a movement that was
 * never filmed, so a beat describing something the operator did not do is worse than
 * useless: it is a paid render that does not match.
 */

const BeatSchema = z.object({
  at: z.number().describe("seconds from clip start"),
  duration: z.number().describe("how long this beat runs, in seconds"),
  action: z.string().describe("what the body does, one short imperative sentence"),
  line: z.string().nullable().describe("what to say, or null for a silent beat"),
});

const BeatSheetSchema = z.object({
  beats: z.array(BeatSchema).min(2).max(8),
});

export type BeatSheetInput = {
  productName: string;
  productCategory: string;
  hookAngle: string;
  hasSample: boolean;
  character: Character | null;
};

const SYSTEM = [
  "You write beat sheets for short vertical product videos filmed in one continuous take.",
  "",
  "A beat sheet is an instruction to the person holding the camera, written before they film.",
  "It is not a description of footage that already exists. Every beat must be something a real",
  "person can actually perform, because the footage is later used to drive a video model that",
  "copies the filmed motion exactly and cannot invent movement that was not performed.",
  "",
  "Hard rules:",
  `- Total runtime must be between ${MIN_RUN_SECONDS} and ${MAX_RUN_SECONDS} seconds. Longer clips cost meaningfully more money.`,
  "- Beats are contiguous. The first starts at 0, and each subsequent beat starts exactly where the previous one ended.",
  "- Every beat describes motion a person can perform standing in one spot facing the camera.",
  "- No cuts, no camera movement, no walking out of frame, no cutaways. One continuous take.",
  "- The product must be in frame by beat two at the latest.",
  "- Hands must be visible in at least half of the beats. Hands are the strongest realism tell.",
  "- Spoken lines are short and conversational, the way a person actually talks on camera. A beat can be silent, with line set to null.",
  "- Never use an em dash. Not in an action, not in a line. Use a comma, a full stop or a rewrite.",
  "",
  "Write the action as a short imperative describing the body, for example",
  '"Lift the product into frame, chest height." Write the line as the exact words to say.',
].join("\n");

export type ValidationIssue = string;

/**
 * Re-checks the rules in code after the call. A rule stated in a prompt is a strong
 * preference, not a guarantee, and a beat sheet that quietly breaks one is not
 * discovered until the operator has already filmed against it.
 */
export function validateBeats(beats: Beat[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (beats.length < 2) {
    issues.push("A beat sheet needs at least two beats.");
    return issues;
  }

  const total = beats.reduce((sum, beat) => sum + beat.duration, 0);
  if (total < MIN_RUN_SECONDS || total > MAX_RUN_SECONDS) {
    issues.push(
      `Total runtime is ${total.toFixed(1)}s, outside the ${MIN_RUN_SECONDS} to ${MAX_RUN_SECONDS}s window.`,
    );
  }

  if (Math.abs(beats[0].at) > 0.01) {
    issues.push("The first beat does not start at 0 seconds.");
  }

  for (let i = 1; i < beats.length; i += 1) {
    const expected = beats[i - 1].at + beats[i - 1].duration;
    if (Math.abs(beats[i].at - expected) > 0.01) {
      issues.push(
        `Beat ${i + 1} starts at ${beats[i].at}s but beat ${i} ends at ${expected.toFixed(1)}s. ` +
          "Gaps put the teleprompter out of step with the render prompt.",
      );
    }
  }

  if (beats.some((beat) => beat.duration <= 0)) {
    issues.push("Every beat needs a positive duration.");
  }

  const text = beats.map((b) => `${b.action} ${b.line ?? ""}`).join(" ");
  if (text.includes("—")) {
    issues.push("An em dash appeared in the beat sheet.");
  }

  const handBeats = beats.filter((beat) => /\bhand|\bhands|\bgrip|\bhold|\blift|\brotate|\bpoint|\bgesture/i.test(beat.action));
  if (handBeats.length * 2 < beats.length) {
    issues.push(
      `Hands appear in ${handBeats.length} of ${beats.length} beats. The spec asks for at least half, ` +
        "because hands are the strongest realism tell.",
    );
  }

  return issues;
}

/** Position in the sheet, 1-indexed, where the product first enters frame. */
export function productEntersAtBeat(beats: Beat[], productName: string): number | null {
  const needle = productName.trim().toLowerCase();
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  for (let i = 0; i < beats.length; i += 1) {
    const action = beats[i].action.toLowerCase();
    if (action.includes("product") || words.some((w) => action.includes(w))) {
      return i + 1;
    }
  }
  return null;
}

export async function generateBeats(input: BeatSheetInput): Promise<Beat[]> {
  const client = new Anthropic();

  const context = [
    `Product: ${input.productName}`,
    input.productCategory ? `Category: ${input.productCategory}` : null,
    input.hookAngle ? `Hook angle: ${input.hookAngle}` : null,
    `Sample on hand: ${input.hasSample ? "yes" : "no"}`,
    input.character
      ? `Presenter: a ${input.character.age}-year-old ${input.character.gender} ${input.character.profession}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Write the beat sheet for this video.\n\n${context}`,
      },
    ],
    output_config: { format: zodOutputFormat(BeatSheetSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("The model did not return a usable beat sheet.");
  }
  return parsed.beats;
}

const CharacterSchema = z.object({
  age: z.number().int().min(18).max(90).describe("apparent age of the presenter"),
  gender: z.string().describe("one word, for example male or female"),
  profession: z.string().describe("a job that makes this person credible about the product"),
  build: z.string().describe("two or three words, physical build"),
  hair: z.string().describe("hair and eyes together, one short phrase"),
  outfit: z.string().describe("what they wear on camera, one phrase, specific and physical"),
  product: z.string().describe("how the product appears in their hands, one short phrase"),
});

/**
 * Casts a whole character in one call. Typing seven fields by hand is the slowest part of
 * starting a run and almost never what the operator actually wants to do, so the default
 * path is one click and then rerolling whatever does not fit.
 */
export async function generateCharacter(input: {
  productName: string;
  productCategory: string;
  hookAngle: string;
  operatorAge: number;
}): Promise<Character> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system:
      "You cast believable on-camera presenters for short vertical product videos. Pick someone " +
      "whose job and appearance make them credible about this specific product, the kind of " +
      "person whose opinion on it you would actually stop scrolling for. Keep every field " +
      "concrete and physical, the way a casting note reads, not adjectives. Never use an em dash.",
    messages: [
      {
        role: "user",
        content:
          `Product: ${input.productName}
` +
          (input.productCategory ? `Category: ${input.productCategory}
` : "") +
          (input.hookAngle ? `Hook angle: ${input.hookAngle}
` : "") +
          `
The operator speaking the lines is about ${input.operatorAge}. Their real voice is ` +
          "relayed over the finished render, so keep the apparent age within about fifteen years " +
          "of that or the voice and face will not match.",
      },
    ],
    output_config: { format: zodOutputFormat(CharacterSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("The model did not return a character.");
  }
  return parsed;
}

/** Rerolls one character field, given the rest, so the character stays coherent. */
export async function rerollCharacterField(
  field: keyof Character,
  character: Character,
  productName: string,
): Promise<string> {
  const client = new Anthropic();

  const others = (Object.keys(character) as (keyof Character)[])
    .filter((key) => key !== field)
    .map((key) => `${key}: ${character[key]}`)
    .join("\n");

  const Result = z.object({ value: z.string() });

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system:
      "You invent believable on-camera presenters for short product videos. Return one new value " +
      "for the requested field that fits the rest of the character and the product. Keep it " +
      "concrete and physical, a few words, the way a casting note reads. Never use an em dash.",
    messages: [
      {
        role: "user",
        content:
          `Product: ${productName}\n\nThe rest of the character:\n${others}\n\n` +
          `Give me a new value for "${field}". The current value is "${character[field]}", so return something different.`,
      },
    ],
    output_config: { format: zodOutputFormat(Result) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("The model did not return a value.");
  }
  return parsed.value;
}
