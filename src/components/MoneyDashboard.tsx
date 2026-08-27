"use client";

import { useState } from "react";
import type { DayPoint, MoneySummary } from "@/lib/money";
import { formatCents } from "@/lib/cost";

/*
  Two series, fixed order, never cycled. The pair came out of the palette validator rather
  than out of taste: the obvious green-for-earned against red-for-spend fails colour-vision
  separation badly (deutan dE 6.6, in the floor band), while blue against magenta clears
  every check (protan dE 19.9, tritan 35.9). Both are also direct-labelled and carry a
  legend, so identity is never colour alone.
*/
const EARNED = "var(--series-earned)";
const SPEND = "var(--series-spend)";

function money(cents: number): string {
  return formatCents(cents);
}

function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${m}/${d}`;
}

/** A headline figure with its label. Not a chart, because one number is not a chart. */
function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "ok" | "rec" | "plain";
  sub?: string;
}) {
  const color = tone === "ok" ? "var(--ok)" : tone === "rec" ? "var(--rec)" : "var(--ink)";
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value mono" style={{ color }}>
        {value}
      </p>
      {sub ? <p className="stat-sub">{sub}</p> : null}
    </div>
  );
}

/**
 * Daily spend against daily earnings. Both are dollars, so they share one axis. Two
 * y-scales on one chart is the single most common way to make a chart lie, so there is
 * only ever one here.
 */
function DailyBars({ points }: { points: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => Math.max(p.spendCents, p.earnedCents)));
  const W = 640;
  const H = 200;
  const PAD_L = 52;
  const PAD_B = 26;
  const PAD_T = 10;
  const plotW = W - PAD_L - 12;
  const plotH = H - PAD_B - PAD_T;

  const slot = plotW / Math.max(1, points.length);
  const barW = Math.min(18, Math.max(5, slot / 2 - 3));

  const ticks = [0, 0.5, 1].map((f) => ({ f, value: max * f }));

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily spend and earnings">
        {ticks.map((t) => {
          const y = PAD_T + plotH - t.f * plotH;
          return (
            <g key={t.f}>
              <line x1={PAD_L} x2={W - 12} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD_L - 8} y={y + 3.5} textAnchor="end" className="chart-tick">
                {money(Math.round(t.value))}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => {
          const x = PAD_L + i * slot + slot / 2;
          const eH = (p.earnedCents / max) * plotH;
          const sH = (p.spendCents / max) * plotH;
          return (
            <g
              key={p.day}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Hit target wider than the marks, so hovering is not a precision task. */}
              <rect x={x - slot / 2} y={PAD_T} width={slot} height={plotH} fill="transparent" />
              {/* 2px gap between the pair, and rounded data-ends anchored to the baseline. */}
              <rect
                x={x - barW - 1}
                y={PAD_T + plotH - eH}
                width={barW}
                height={eH}
                rx="2"
                fill={EARNED}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <rect
                x={x + 1}
                y={PAD_T + plotH - sH}
                width={barW}
                height={sH}
                rx="2"
                fill={SPEND}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <text x={x} y={H - 8} textAnchor="middle" className="chart-tick">
                {shortDay(p.day)}
              </text>
            </g>
          );
        })}

        <line
          x1={PAD_L}
          x2={W - 12}
          y1={PAD_T + plotH}
          y2={PAD_T + plotH}
          stroke="var(--line-strong)"
          strokeWidth="1"
        />
      </svg>

      {hover !== null ? (
        <div className="chart-tip">
          <strong>{points[hover].day}</strong>
          <span>
            <i style={{ background: EARNED }} /> earned {money(points[hover].earnedCents)}
          </span>
          <span>
            <i style={{ background: SPEND }} /> spend {money(points[hover].spendCents)}
          </span>
          <span className="chart-tip-sub">
            {points[hover].runCount} run{points[hover].runCount === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Cumulative earnings against the goal line. This is the one that answers "am I on track". */
function CumulativeLine({ points, goalCents }: { points: DayPoint[]; goalCents: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 190;
  const PAD_L = 52;
  const PAD_B = 26;
  const PAD_T = 14;
  const plotW = W - PAD_L - 12;
  const plotH = H - PAD_B - PAD_T;

  const peak = Math.max(goalCents, ...points.map((p) => p.cumulativeEarnedCents));
  const x = (i: number) => PAD_L + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (c: number) => PAD_T + plotH - (c / peak) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.cumulativeEarnedCents)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${PAD_T + plotH} L${x(0)},${PAD_T + plotH} Z`;
  const goalY = y(goalCents);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cumulative commission earned against the goal">
        <defs>
          <linearGradient id="earnedFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-earned)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--series-earned)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* The goal as a reference line, labelled, so "on track" is readable at a glance. */}
        <line x1={PAD_L} x2={W - 12} y1={goalY} y2={goalY} stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={PAD_L} y={goalY - 6} className="chart-tick">
          goal {money(goalCents)}
        </text>

        <path d={area} fill="url(#earnedFade)" />
        <path d={line} fill="none" stroke={EARNED} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={p.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(i) - 14} y={PAD_T} width={28} height={plotH} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.cumulativeEarnedCents)}
              r={hover === i ? 5 : 3.5}
              fill={EARNED}
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ))}

        <line x1={PAD_L} x2={W - 12} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="var(--line-strong)" strokeWidth="1" />
        {points.map((p, i) => (
          <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" className="chart-tick">
            {shortDay(p.day)}
          </text>
        ))}
      </svg>

      {hover !== null ? (
        <div className="chart-tip">
          <strong>{points[hover].day}</strong>
          <span>earned to date {money(points[hover].cumulativeEarnedCents)}</span>
          <span className="chart-tip-sub">
            net {money(points[hover].cumulativeNetCents)} after spend
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function MoneyDashboard({ summary }: { summary: MoneySummary }) {
  const { byDay } = summary;
  const positive = summary.netCents >= 0;
  const committed = summary.spentCents + summary.committedCents;

  return (
    <>
      <div className="stat-row">
        <Stat label="Commission earned" value={money(summary.earnedCents)} sub={`${summary.goalPct.toFixed(1)}% of goal`} />
        <Stat label="Render spend" value={money(committed)} sub={summary.committedCents > 0 ? `${money(summary.committedCents)} still rendering` : "all billed"} />
        <Stat
          label="Net"
          value={`${positive ? "" : "-"}${money(Math.abs(summary.netCents))}`}
          tone={positive ? "ok" : "rec"}
          sub={positive ? "net positive" : "net negative"}
        />
      </div>

      {/* The goal is a commission target, so the meter tracks earnings. Spend is a cost. */}
      <section className="card">
        <div className="card-head">
          <span className="card-title">Toward {money(summary.goalCents)}</span>
          <span className="tag mono">{summary.daysLeft} days left</span>
        </div>
        <div className="meter" role="img" aria-label={`${summary.goalPct.toFixed(1)} percent of the commission goal`}>
          <div className="meter-fill" style={{ width: `${Math.max(summary.goalPct, 0.6)}%` }} />
        </div>
        <p className="stat-sub" style={{ marginTop: "0.625rem" }}>
          {money(summary.earnedCents)} of {money(summary.goalCents)} earned.{" "}
          {money(summary.goalCents - summary.earnedCents)} to go.
        </p>
      </section>

      {summary.unreportedCount > 0 ? (
        <p className="note note-warn">
          {summary.unreportedCount} finished render{summary.unreportedCount === 1 ? " has" : "s have"} a
          cost but no commission recorded. Until that is filled in on the finish step, this page
          undercounts what the work actually returned.
        </p>
      ) : null}

      {byDay.length === 0 ? (
        <section className="card">
          <p className="stat-sub">
            No money recorded yet. Costs appear once a render is billed, and earnings once you enter
            the commission on a run.
          </p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <span className="card-title">Earned against spend, by day</span>
              <span className="legend">
                <span>
                  <i style={{ background: EARNED }} /> earned
                </span>
                <span>
                  <i style={{ background: SPEND }} /> spend
                </span>
              </span>
            </div>
            <DailyBars points={byDay} />
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-title">Cumulative earnings</span>
            </div>
            <CumulativeLine points={byDay} goalCents={summary.goalCents} />
          </section>
        </>
      )}
    </>
  );
}
