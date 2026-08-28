"use client";

import { useCallback, useMemo, useState } from "react";
import { ATTRIBUTE_KEYS, getBucket, resolveAttributeItems, rollCharacter } from "@/lib/prompt/casting";
import { PROFESSION_ORDER, professionBuckets } from "@/lib/prompt/data/professions";
import { makeSeed } from "@/lib/prompt/random";
import { buildAvatarPrompt, buildCharacterPrompt, type SourceSubject } from "@/lib/prompt/templates/character";
import type { AttributeKey, CharacterRoll, Gender, WeightedOption } from "@/lib/prompt/types";
import BuilderShell from "./builder-shell";
import OutputPanel from "./output-panel";
import SlotGrid from "./slot-grid";

/**
 * The character builder.
 *
 * Everything regenerates on every input change, not only on the button. The button exists
 * to force a new roll and to give the interaction a target; a user should never be able to
 * look at a prompt that no longer matches the controls above it.
 */
export default function CharacterBuilder({
  seed: initialSeed,
  initial,
  onChange,
}: {
  /*
    Required and minted on the server. Calling makeSeed() during render would produce a
    different value on the server and the client, which is a hydration mismatch, and would
    also reroll the character on every reload.
  */
  seed: string;
  initial?: {
    seed?: string | null;
    roll?: CharacterRoll | null;
    age?: number;
    gender?: Gender;
    professionKey?: string;
    customNoun?: string;
    productInstruction?: string;
  };
  onChange?: (state: { seed: string; roll: CharacterRoll; prompt: string }) => void;
}) {
  const [age, setAge] = useState(String(initial?.age ?? initial?.roll?.age ?? 24));
  const [gender, setGender] = useState<Gender>(initial?.gender ?? initial?.roll?.gender ?? "male");
  const [professionKey, setProfessionKey] = useState(initial?.professionKey ?? "construction");
  const [customNoun, setCustomNoun] = useState(initial?.customNoun ?? "");
  const [productInstruction, setProductInstruction] = useState(initial?.productInstruction ?? "");
  const [seed, setSeed] = useState(initialSeed);

  const [mode, setMode] = useState<"character" | "avatar">("character");
  const [sourceSubject, setSourceSubject] = useState<SourceSubject>("person in the reference image");

  // Avatar mode fields. No roll, no tables.
  const [referenceName, setReferenceName] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [changes, setChanges] = useState("");
  const [pronoun, setPronoun] = useState<"her" | "him" | "them">("her");

  const roll = useMemo(
    () => rollCharacter({ seed, age, gender, professionKey, customNoun }),
    [seed, age, gender, professionKey, customNoun],
  );

  /** The lists the spin animation samples from, resolved the same way the roll was. */
  const pools = useMemo(() => {
    const bucket = getBucket(professionKey, customNoun);
    return Object.fromEntries(
      ATTRIBUTE_KEYS.map((key) => [key, resolveAttributeItems(bucket, key, gender)]),
    ) as Partial<Record<AttributeKey, WeightedOption[]>>;
  }, [professionKey, customNoun, gender]);

  const prompt = useMemo(
    () =>
      mode === "avatar"
        ? buildAvatarPrompt({ referenceName, avatarName, changes, pronoun })
        : buildCharacterPrompt(roll, { sourceSubject, productInstruction }),
    [mode, roll, sourceSubject, productInstruction, referenceName, avatarName, changes, pronoun],
  );

  // Only ever called from a click, never during render, so Math.random is safe here.
  const reroll = useCallback(() => {
    setSeed(makeSeed());
  }, []);

  function save() {
    onChange?.({ seed, roll, prompt });
  }

  const isCustom = professionKey === "custom";

  const controls = (
    <>
      <p className="eyebrow">{mode === "avatar" ? "Avatar match" : "Cast a presenter"}</p>

      {mode === "character" ? (
        <>
          <div className="builder-field">
            <label className="label" htmlFor="pg-age">Age</label>
            <input
              id="pg-age"
              className="field"
              type="number"
              min={19}
              max={85}
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <span className="builder-help">
              Use adults only. The prompt will always say adult, and anything outside 19 to 85 is
              clamped before it reaches the text.
            </span>
          </div>

          <div className="builder-field">
            <label className="label" htmlFor="pg-gender">Gender</label>
            <select
              id="pg-gender"
              className="field"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <span className="builder-help">
              Drives which hair and outfit wording is compatible, so a female roll never inherits a
              male-only option from a trade table.
            </span>
          </div>

          <div className="builder-field">
            <label className="label" htmlFor="pg-profession">Character</label>
            <select
              id="pg-profession"
              className="field"
              value={professionKey}
              onChange={(e) => setProfessionKey(e.target.value)}
            >
              {PROFESSION_ORDER.map((key) => (
                <option key={key} value={key}>
                  {professionBuckets[key].label}
                </option>
              ))}
              <option value="custom">Custom identifier</option>
            </select>
          </div>

          {isCustom ? (
            <div className="builder-field">
              <label className="label" htmlFor="pg-custom">Custom identifier</label>
              <input
                id="pg-custom"
                className="field"
                value={customNoun}
                onChange={(e) => setCustomNoun(e.target.value)}
                placeholder="dog groomer"
              />
              <span className="builder-help">
                Wardrobe falls back to the gender pool, since a custom role has no wardrobe table.
              </span>
            </div>
          ) : null}

          <div className="builder-field">
            <label className="label" htmlFor="pg-product">Product or outfit</label>
            <textarea
              id="pg-product"
              className="field"
              rows={3}
              value={productInstruction}
              onChange={(e) => setProductInstruction(e.target.value)}
              placeholder="holding a red branded work cap, logo facing camera"
            />
            <span className="builder-help">Left blank, this paragraph is omitted entirely.</span>
          </div>
        </>
      ) : (
        <>
          <div className="builder-field">
            <label className="label" htmlFor="pg-ref">Reference name</label>
            <input id="pg-ref" className="field" value={referenceName} onChange={(e) => setReferenceName(e.target.value)} placeholder="the phone shot" />
          </div>
          <div className="builder-field">
            <label className="label" htmlFor="pg-avatar">Avatar image name</label>
            <input id="pg-avatar" className="field" value={avatarName} onChange={(e) => setAvatarName(e.target.value)} placeholder="my avatar" />
          </div>
          <div className="builder-field">
            <label className="label" htmlFor="pg-pronoun">Pronouns</label>
            <select id="pg-pronoun" className="field" value={pronoun} onChange={(e) => setPronoun(e.target.value as "her" | "him" | "them")}>
              <option value="her">her</option>
              <option value="him">him</option>
              <option value="them">them</option>
            </select>
          </div>
          <div className="builder-field">
            <label className="label" htmlFor="pg-changes">Changes to make</label>
            <textarea id="pg-changes" className="field" rows={3} value={changes} onChange={(e) => setChanges(e.target.value)} placeholder="blue eyes, lighter hair" />
            <span className="builder-help">
              Anything left blank stays as a visible bracketed placeholder, so an unfinished prompt
              is obvious rather than silently wrong.
            </span>
          </div>
        </>
      )}

      <details className="builder-advanced">
        <summary>Advanced</summary>
        <div className="builder-field">
          <label className="label" htmlFor="pg-mode">Prompt type</label>
          <select id="pg-mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as "character" | "avatar")}>
            <option value="character">Create new character</option>
            <option value="avatar">Match existing avatar</option>
          </select>
        </div>
        {mode === "character" ? (
          <div className="builder-field">
            <label className="label" htmlFor="pg-source">Source subject</label>
            <select id="pg-source" className="field" value={sourceSubject} onChange={(e) => setSourceSubject(e.target.value as SourceSubject)}>
              <option value="person in the reference image">Person in the reference image</option>
              <option value="man">Man</option>
              <option value="woman">Woman</option>
            </select>
          </div>
        ) : null}
      </details>

      <div className="btn-row" style={{ justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={onChange ? save : reroll}>
          {mode === "avatar" ? "Generate avatar prompt" : onChange ? "Save character" : "Generate character"}
        </button>
        {mode === "character" ? (
          <button type="button" className="btn" onClick={reroll}>
            Reroll details
          </button>
        ) : null}
      </div>

      {mode === "character" ? (
        <p className="builder-help" style={{ textAlign: "center", marginTop: "0.75rem" }}>
          seed <span className="mono">{seed}</span>
        </p>
      ) : null}
    </>
  );

  return (
    <BuilderShell
      controls={controls}
      output={
        <OutputPanel
          label={mode === "avatar" ? "Avatar prompt" : "Image prompt"}
          text={prompt}
          grid={
            mode === "character" ? (
              <SlotGrid roll={roll} pools={pools} onRerollRealism={reroll} />
            ) : undefined
          }
        />
      }
    />
  );
}
