"use client";

import { useState } from "react";
import type { Character, Run } from "@/db/schema";
import VoicePicker from "./VoicePicker";

type TextField = "age" | "gender" | "profession" | "build" | "hair" | "outfit" | "product";

const FIELDS: { key: TextField; label: string }[] = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "profession", label: "Job" },
  { key: "build", label: "Build" },
  { key: "hair", label: "Hair" },
  { key: "outfit", label: "Outfit" },
  { key: "product", label: "Product" },
];

const EMPTY: Character = {
  age: 0,
  gender: "",
  profession: "",
  build: "",
  hair: "",
  outfit: "",
  product: "",
};

/**
 * Casting, as a sheet you correct rather than a form you fill.
 *
 * The default path is one click for all seven fields, then rerolling whatever does not
 * fit. Every value is an input styled as plain text, so it reads as a filled-in casting
 * note but is editable in place with no edit mode to enter.
 */
export default function CharacterBlock({
  run,
  operatorAge,
  onSaved,
}: {
  run: Run;
  operatorAge: number;
  onSaved: (character: Character) => void;
}) {
  const [character, setCharacter] = useState<Character>(run.character ?? EMPTY);
  const [busy, setBusy] = useState<"generate" | TextField | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /*
    The local copy is what the inputs edit, so it has to win while the operator is typing.
    But when the server hands down a different character, that copy is stale. Adjusting
    during render rather than in an effect is the sanctioned way to fold new props into
    state, and it avoids the extra render pass an effect would cost on every keystroke.
  */
  const [seenCharacter, setSeenCharacter] = useState(run.character);
  if (seenCharacter !== run.character) {
    setSeenCharacter(run.character);
    if (run.character) {
      setCharacter(run.character);
      setDirty(false);
    }
  }

  const cast = Boolean(character.gender || character.profession);
  const ageGap = Math.abs(character.age - operatorAge);

  function set<K extends keyof Character>(key: K, value: Character[K]) {
    setCharacter((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function call(payload: object) {
    setError(null);
    const response = await fetch(`/api/runs/${run.id}/character`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "That did not work.");
      return null;
    }
    return data;
  }

  async function generate() {
    setBusy("generate");
    const data = await call({ action: "generate" });
    if (data?.character) {
      setCharacter(data.character);
      setDirty(false);
      onSaved(data.character);
    }
    setBusy(null);
  }

  async function reroll(field: TextField) {
    setBusy(field);
    const data = await call({ action: "reroll", field, character });
    if (data && data.value !== undefined) set(field, data.value);
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    const data = await call({ action: "save", character });
    if (data) {
      setDirty(false);
      onSaved(character);
    }
    setBusy(null);
  }

  if (!cast) {
    return (
      <>
        {error ? <p className="note note-rec">{error}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy !== null}>
            {busy === "generate" ? "Casting" : "Cast a character"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="rows">
        {FIELDS.map((field) => (
          <div className="row" key={field.key}>
            <span className="row-key">{field.label}</span>
            <input
              className="row-value"
              type={field.key === "age" ? "number" : "text"}
              value={character[field.key]}
              onChange={(event) =>
                set(
                  field.key,
                  (field.key === "age"
                    ? Number(event.target.value) || 0
                    : event.target.value) as Character[typeof field.key],
                )
              }
            />
            <button
              type="button"
              className="row-action"
              onClick={() => reroll(field.key)}
              disabled={busy !== null}
            >
              {busy === field.key ? "..." : "reroll"}
            </button>
          </div>
        ))}
      </div>

      {/*
        Soft warning, never a block. The operator's own voice is relayed over the render,
        so a young voice under an old face reads wrong immediately and undoes the realism
        everything else here is buying. It is still their call.
      */}
      {ageGap > 15 ? (
        <p className="note note-warn">
          {ageGap} years from your own age of {operatorAge}. Your real voice goes over this render, so
          a face and voice that far apart reads wrong. Move the age closer, or film silent and carry
          the hook in on-screen text.
        </p>
      ) : null}

      <VoicePicker
        character={character}
        onChange={(voiceId, voiceName) => {
          setCharacter((c) => ({ ...c, voiceId, voiceName }));
          setDirty(true);
        }}
      />

      {error ? <p className="note note-rec">{error}</p> : null}

      <div className="btn-row">
        {dirty ? (
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy !== null}>
            {busy === "save" ? "Saving" : "Save changes"}
          </button>
        ) : (
          <span className="tag" style={{ color: "var(--ok)" }}>Saved</span>
        )}
        <button type="button" className="btn btn-quiet" onClick={generate} disabled={busy !== null}>
          {busy === "generate" ? "Casting" : "Recast everything"}
        </button>
      </div>
    </>
  );
}
