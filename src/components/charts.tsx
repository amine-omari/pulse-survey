"use client";

/** Small SVG charts drawn to the theme tokens. Purple accent, tinted steps for series. */

const SERIES = [
  "var(--accent)",
  "color-mix(in oklab, var(--accent) 75%, var(--surface-2))",
  "color-mix(in oklab, var(--accent) 55%, var(--surface-2))",
  "color-mix(in oklab, var(--accent) 40%, var(--surface-2))",
  "color-mix(in oklab, var(--accent) 28%, var(--surface-2))",
  "color-mix(in oklab, var(--accent) 18%, var(--surface-2))",
  "color-mix(in oklab, var(--accent) 12%, var(--surface-2))",
  "color-mix(in oklab, var(--accent) 8%, var(--surface-2))",
];

export const seriesColor = (i: number) => SERIES[Math.min(i, SERIES.length - 1)];

export type Slice = { label: string; n: number };

/** Donut with the leading answer in the middle. */
export function Donut({ rows, total, size = 168 }: { rows: Slice[]; total: number; size?: number }) {
  const r = 42;
  const stroke = 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const ranked = rows.map((s, i) => ({ ...s, i })).sort((a, b) => b.n - a.n);
  const top = ranked[0];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Share of answers">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      {total > 0 &&
        rows.map((s, i) => {
          const frac = s.n / total;
          const dash = frac * c;
          const el = (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={seriesColor(i)}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += dash;
          return el;
        })}
      <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {total ? `${Math.round((top.n / total) * 100)}%` : "–"}
      </text>
      <text x="60" y="72" textAnchor="middle" fontSize="8" fill="var(--muted)">
        {total ? truncate(top.label, 18) : "no answers"}
      </text>
    </svg>
  );
}

/** Vertical columns, one per scale step, with the average marked. */
export function Histogram({ steps, avg }: { steps: { label: string; n: number }[]; avg: number | null }) {
  const W = 320;
  const H = 120;
  const padB = 18;
  const padT = 14;
  const max = Math.max(1, ...steps.map((s) => s.n));
  const gap = 4;
  const bw = (W - gap * (steps.length - 1)) / steps.length;
  const min = Number(steps[0].label);
  const stepW = bw + gap;
  const avgX = avg === null ? null : (avg - min) * stepW + bw / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Distribution of ratings">
      {steps.map((s, i) => {
        const h = (s.n / max) * (H - padB - padT);
        const x = i * stepW;
        const y = H - padB - h;
        const hot = avg !== null && Math.round(avg) === Number(s.label);
        return (
          <g key={s.label}>
            <rect x={x} y={padT} width={bw} height={H - padB - padT} rx="4" fill="var(--surface-2)" />
            {s.n > 0 && <rect x={x} y={y} width={bw} height={h} rx="4" fill={hot ? "var(--accent)" : seriesColor(2)} />}
            {s.n > 0 && (
              <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {s.n}
              </text>
            )}
            <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.label}
            </text>
          </g>
        );
      })}
      {avgX !== null && (
        <line x1={avgX} x2={avgX} y1={padT - 6} y2={H - padB} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 3" />
      )}
    </svg>
  );
}

/** Horizontal comparison of several averages on the same scale. */
export function AverageBars({ rows, max }: { rows: { label: string; avg: number | null; n: number }[]; max: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
      {rows.map((r) => {
        const pct = r.avg === null ? 0 : (r.avg / max) * 100;
        const tone = r.avg === null ? "var(--surface-2)" : r.avg / max >= 0.7 ? "var(--accent)" : r.avg / max >= 0.45 ? seriesColor(2) : "var(--danger)";
        return (
          <div key={r.label} className="contents">
            <div className="min-w-0 flex flex-col gap-1.5">
              <span className="text-sm font-medium truncate">{r.label}</span>
              <div className="bar" style={{ height: 12 }}>
                <span style={{ width: `${pct}%`, background: tone }} />
              </div>
            </div>
            <div className="text-right self-end">
              <span className="text-2xl font-bold tabular-nums leading-none">{r.avg === null ? "–" : r.avg.toFixed(1)}</span>
              <span className="text-xs text-muted tabular-nums"> / {max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ rows, total }: { rows: Slice[]; total: number }) {
  return (
    <ul className="flex flex-col gap-2 min-w-0">
      {rows.map((r, i) => {
        const pct = total ? Math.round((r.n / total) * 100) : 0;
        return (
          <li key={r.label} className="grid items-center gap-2" style={{ gridTemplateColumns: "10px minmax(0,1fr) auto" }}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: seriesColor(i) }} />
            <span className="text-sm truncate">{r.label}</span>
            <span className="text-sm text-muted tabular-nums">
              {r.n} <span className="opacity-60">·</span> {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
