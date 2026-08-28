"use client";

import { useState } from "react";
import type { Character } from "@/db/schema";

type Voice = {
  voiceId: string;
  name: string;
  category: string | null;
  previewUrl: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  description: string | null;
};

/**
 * Voice selection, during casting, alongside the seven physical fields.
 *
 * The suggestion is matched on the character's age and gender because those are the two
 * things a viewer notices instantly when they disagree with the face. It is a starting
 * point: every voice can be previewed before picking.
 */
export default function VoicePicker({
  character,
  onChange,
}: {
  character: Character;
  onChange: (voiceId: string, voiceName: string) => void;
}) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/voices?age=${character.age}&gender=${encodeURIComponent(character.gender)}`,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? "Could not load voices.");
      setBusy(false);
      return;
    }
    setVoices(data.voices ?? []);
    setSuggested(data.suggestedVoiceId ?? null);
    setBusy(false);
  }

  function preview(voice: Voice) {
    if (!voice.previewUrl) return;
    const audio = new Audio(voice.previewUrl);
    setPlaying(voice.voiceId);
    audio.onended = () => setPlaying(null);
    audio.play().catch(() => setPlaying(null));
  }

  const chosen = character.voiceId ?? null;

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Voice</span>
        {character.voiceName ? <span className="tag">using {character.voiceName}</span> : null}
      </div>

      <p className="stat-sub" style={{ marginBottom: "0.75rem" }}>
        Your take drives the lip motion, so the conversion keeps your exact timing and delivery and
        changes only the voice. Leave this unset to keep your own.
      </p>

      {error ? <p className="note note-rec">{error}</p> : null}

      {voices === null ? (
        <button type="button" className="btn" onClick={load} disabled={busy}>
          {busy ? "Loading voices" : "Browse voices"}
        </button>
      ) : voices.length === 0 ? (
        <p className="stat-sub">No voices on this ElevenLabs account.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.375rem", maxHeight: "22rem", overflowY: "auto" }}>
          {voices.map((v) => (
            <div
              key={v.voiceId}
              className="candidate"
              style={{
                padding: "0.625rem 0.75rem",
                borderColor: v.voiceId === chosen ? "var(--accent)" : undefined,
              }}
            >
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: 550 }}>
                    {v.name}
                    {v.voiceId === suggested ? (
                      <span className="tag" style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>
                        suggested for this character
                      </span>
                    ) : null}
                  </p>
                  <p className="tag">
                    {[v.gender, v.age, v.accent, v.description].filter(Boolean).join(" · ") ||
                      v.category ||
                      "no labels"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => preview(v)}
                    disabled={!v.previewUrl}
                    title={v.previewUrl ? undefined : "No preview on this voice"}
                  >
                    {playing === v.voiceId ? "playing" : "preview"}
                  </button>
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => onChange(v.voiceId, v.name)}
                    style={v.voiceId === chosen ? { color: "var(--ok)", borderColor: "var(--ok)" } : undefined}
                  >
                    {v.voiceId === chosen ? "chosen" : "use"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
