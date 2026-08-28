"use client";

import { useEffect, useRef, useState } from "react";
import type { AttributeKey, CharacterRoll, WeightedOption } from "@/lib/prompt/types";

/**
 * Six cards in a 3x2 grid, plus the realism line underneath.
 *
 * Realism deliberately gets no card: six fit the grid cleanly and it is the least
 * interesting slot to look at. But it is rolled, so it is shown, because a rolled value
 * the user cannot see or reroll is invisible state. It sits below the grid in mono muted
 * with its own reroll control.
 */

const SLOTS: { key: Exclude<AttributeKey, "realism">; label: string }[] = [
  { key: "body", label: "Body" },
  { key: "face", label: "Face" },
  { key: "hair", label: "Hair" },
  { key: "eyes", label: "Eyes" },
  { key: "skin", label: "Skin" },
  { key: "outfit", label: "Outfit" },
];

/**
 * The one piece of theater in the tool, and it does most of the work of making this feel
 * like a machine rather than a form. Each card cycles three values from its own resolved
 * list, staggered 60ms apart, before settling on the real one.
 */
type SpinState = {
  seed: string;
  values: Record<string, string>;
  spinning: Record<string, boolean>;
};

function useSpin(roll: CharacterRoll | null, pools: Partial<Record<AttributeKey, WeightedOption[]>>) {
  /*
    Keyed by seed rather than cleared between rolls. A stale entry from the previous roll
    is simply ignored at render time, which means the effect only ever schedules timers
    and never writes state synchronously, and the settled value needs no write at all: it
    is what the roll already says.
  */
  const [spin, setSpin] = useState<SpinState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const seed = roll?.seed ?? null;

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!roll || !seed) return;

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Nothing to schedule: the fallback below already renders the settled value.
    if (reduced) return;

    SLOTS.forEach((slot, index) => {
      const pool = pools[slot.key] ?? [];
      const start = index * 60;

      for (let tick = 0; tick < 3; tick += 1) {
        timers.current.push(
          setTimeout(() => {
            const sample = pool.length
              ? pool[Math.floor(Math.random() * pool.length)].text
              : roll[slot.key];
            setSpin((current) => {
              const base =
                current && current.seed === seed ? current : { seed, values: {}, spinning: {} };
              return {
                seed,
                values: { ...base.values, [slot.key]: sample },
                spinning: { ...base.spinning, [slot.key]: true },
              };
            });
          }, start + tick * 70),
        );
      }

      timers.current.push(
        setTimeout(
          () => {
            setSpin((current) => {
              if (!current || current.seed !== seed) return current;
              const values = { ...current.values };
              delete values[slot.key];
              return { seed, values, spinning: { ...current.spinning, [slot.key]: false } };
            });
          },
          start + 3 * 70,
        ),
      );
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [roll, seed, pools]);

  const active = spin && spin.seed === seed ? spin : null;
  return {
    valueFor: (key: Exclude<AttributeKey, "realism">) =>
      active?.values[key] ?? (roll ? roll[key] : ""),
    isSpinning: (key: Exclude<AttributeKey, "realism">) => Boolean(active?.spinning[key]),
  };
}

export default function SlotGrid({
  roll,
  pools,
  onRerollRealism,
}: {
  roll: CharacterRoll | null;
  pools: Partial<Record<AttributeKey, WeightedOption[]>>;
  onRerollRealism: () => void;
}) {
  const { valueFor, isSpinning } = useSpin(roll, pools);

  if (!roll) {
    return (
      <div className="slot-grid">
        {SLOTS.map((slot) => (
          <div className="slot" key={slot.key}>
            <span className="slot-label">{slot.label}</span>
            <span className="slot-value" style={{ color: "var(--ink-faint)" }}>
              not rolled
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="slot-grid">
        {SLOTS.map((slot) => (
          <div className="slot" key={slot.key} data-spinning={isSpinning(slot.key) ? "true" : "false"}>
            <span className="slot-label">{slot.label}</span>
            <span className="slot-value">{valueFor(slot.key)}</span>
          </div>
        ))}
      </div>
      <div className="slot-realism">
        <span className="slot-label">Realism</span>
        <span className="mono">{roll.realism}</span>
        <button type="button" className="row-action" onClick={onRerollRealism} aria-label="Reroll the realism clause">
          reroll
        </button>
      </div>
    </>
  );
}
