import type { CSSProperties, ReactNode } from "react";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Small HTML charts for Admin → Statistiky (crisp text at any width, hover
 * and keyboard tooltips through ChartTooltip). Colors are validated for
 * colour-blind readers; every chart also has its numbers in a table.
 */
export const SERIES = { primary: "#4f7a3a", second: "#c27c32" };

/** Sequential one-hue ramp (light → dark green) for the heatmap. */
const LIGHT = [238, 240, 226];
const DARK = [44, 74, 31];
export function ramp(t: number) {
  const k = Math.max(0, Math.min(1, t));
  const c = LIGHT.map((l, i) => Math.round(l + (DARK[i] - l) * k));
  return { background: `rgb(${c.join(",")})`, color: k > 0.55 ? "#fff" : "#151a13" };
}

const nice = (max: number) => {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
};

type Column = { label: string; value: number; tip: string };

/** One series of columns (e.g. revenue by month), labels on the highest and the last column. */
export function Columns({ data, format, height = 180 }: { data: Column[]; format: (v: number) => string; height?: number }) {
  const top = nice(Math.max(...data.map((d) => d.value), 0));
  const maxIdx = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  return (
    <ChartTooltip>
      <Frame top={top} format={format} height={height}>
        {data.map((d, i) => (
          <Slot key={i} label={d.label}>
            {(i === maxIdx || i === data.length - 1) && d.value > 0 && <Cap>{format(d.value)}</Cap>}
            <Bar value={d.value} top={top} color={SERIES.primary} tip={d.tip} rounded />
          </Slot>
        ))}
      </Frame>
    </ChartTooltip>
  );
}

type Stack = { label: string; parts: number[]; tip: string };

/** Stacked columns; parts bottom-up in the order of `series`. */
export function StackedColumns({ data, series, height = 180 }: { data: Stack[]; series: { name: string; color: string }[]; height?: number }) {
  const top = nice(Math.max(...data.map((d) => d.parts.reduce((a, b) => a + b, 0)), 0));
  const lastIdx = data.length - 1;
  return (
    <ChartTooltip>
      <Legend series={series} />
      <Frame top={top} format={(v) => String(v)} height={height}>
        {data.map((d, i) => {
          const total = d.parts.reduce((a, b) => a + b, 0);
          return (
            <Slot key={d.label} label={d.label}>
              {i === lastIdx && total > 0 && <Cap>{total}</Cap>}
              <div
                className="flex w-full max-w-6 flex-col-reverse gap-[2px] outline-none focus-visible:ring-2 focus-visible:ring-zlato"
                style={{ height: `${(total / top) * 100}%` }}
                data-tip={d.tip}
                tabIndex={0}
              >
                {d.parts.map((p, k) =>
                  p > 0 ? (
                    <div
                      key={k}
                      className={k === d.parts.findLastIndex((x) => x > 0) ? "rounded-t-[4px]" : ""}
                      style={{ flex: p, background: series[k].color }}
                    />
                  ) : null,
                )}
              </div>
            </Slot>
          );
        })}
      </Frame>
    </ChartTooltip>
  );
}

function Legend({ series }: { series: { name: string; color: string }[] }) {
  return (
    <p className="mb-3 flex flex-wrap gap-4 text-xs text-les/70">
      {series.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px]" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </p>
  );
}

function Frame({ top, format, height, children }: { top: number; format: (v: number) => string; height: number; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <div className="relative w-14 shrink-0 text-right text-[10px] text-les/50" style={{ height }}>
        {[1, 0.5, 0].map((f) => (
          <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>{format(top * f)}</span>
        ))}
      </div>
      <div className="relative flex-1">
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-linka/50" style={{ top: `${f * 100}%` }} />
        ))}
        <div className="relative flex items-end gap-1" style={{ height }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Slot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
      {children}
      <span className="absolute -bottom-5 text-[10px] text-les/60">{label}</span>
    </div>
  );
}

function Cap({ children }: { children: ReactNode }) {
  return <span className="mb-1 whitespace-nowrap text-[10px] font-semibold text-les">{children}</span>;
}

function Bar({ value, top, color, tip, rounded }: { value: number; top: number; color: string; tip: string; rounded?: boolean }) {
  return (
    <div
      className={`w-full max-w-6 outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-zlato ${rounded ? "rounded-t-[4px]" : ""}`}
      style={{ height: `${(value / top) * 100}%`, minHeight: value > 0 ? 2 : 0, background: color }}
      data-tip={tip}
      tabIndex={0}
    />
  );
}

/** Horizontal bars with a value at the tip and a note under the name (e.g. occupancy by class type). */
export function BarList({ rows }: { rows: { name: string; value: number; label: string; note: string; tip: string }[] }) {
  return (
    <ChartTooltip>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
            <span className="text-sm">
              <span className="block truncate font-semibold">{r.name}</span>
              <span className="block text-xs text-les/60">{r.note}</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-3 rounded-r-[4px] outline-none focus-visible:ring-2 focus-visible:ring-zlato"
                style={{ width: `${Math.max(1, r.value * 100) * 0.85}%`, background: SERIES.primary }}
                data-tip={r.tip}
                tabIndex={0}
              />
              <span className="text-xs font-semibold">{r.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </ChartTooltip>
  );
}

/** Weekday × hour grid, each cell shaded by a 0–1 value and labelled. */
export function Heatmap({
  rows,
  cols,
  cell,
}: {
  rows: { key: number; label: string }[];
  cols: { key: number; label: string }[];
  cell: (row: number, col: number) => { value: number; label: string; tip: string } | null;
}) {
  const style = (v: number): CSSProperties => ramp(v);
  return (
    <ChartTooltip>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.key} className="px-1 pb-1 font-normal text-les/60">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th className="pr-2 text-left font-normal text-les/60">{r.label}</th>
                {cols.map((c) => {
                  const v = cell(r.key, c.key);
                  return v ? (
                    <td
                      key={c.key}
                      className="h-9 min-w-12 rounded-[4px] text-center font-semibold outline-none focus-visible:ring-2 focus-visible:ring-zlato"
                      style={style(v.value)}
                      data-tip={v.tip}
                      tabIndex={0}
                    >
                      {v.label}
                    </td>
                  ) : (
                    <td key={c.key} className="h-9 min-w-12 rounded-[4px] bg-krem/30" />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-les/60">
        méně
        <span className="inline-block h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${ramp(0).background}, ${ramp(1).background})` }} />
        plno
      </p>
    </ChartTooltip>
  );
}
