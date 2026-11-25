"use client";

import { useSyncExternalStore } from "react";
import { czPlural, nextDeadline, splitTime, type Deadline } from "@/lib/countdown";

// one shared clock for every countdown on the page, ticking on the whole second
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
const tick = () => {
  now = Date.now();
  listeners.forEach((l) => l());
  timer = setTimeout(tick, 1000 - (now % 1000));
};
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) tick();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}
const snapshot = () => now || (now = Date.now());
// the server (and hydration) don't know the visitor's second – the digits fill in right after
const serverSnapshot = () => 0;

const two = (n: number) => String(n).padStart(2, "0");

/**
 * A live countdown to the first end still ahead (seconds included); when one ends, the next takes over,
 * after the last it disappears. `bar` is one line for the announcement bar, `tiles` four boxes for the pop-up.
 */
export function Countdown({ deadlines, variant }: { deadlines: Deadline[]; variant: "bar" | "tiles" }) {
  const t = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const next = t ? nextDeadline(deadlines, t) : deadlines[0];
  if (!next) return null;
  const left = t ? splitTime(next.at - t) : null;
  const parts = [
    { n: left?.d, short: "d", long: czPlural(left?.d ?? 0, ["den", "dny", "dní"]), pad: false },
    { n: left?.h, short: "h", long: czPlural(left?.h ?? 0, ["hodina", "hodiny", "hodin"]), pad: true },
    { n: left?.m, short: "min", long: czPlural(left?.m ?? 0, ["minuta", "minuty", "minut"]), pad: true },
    { n: left?.s, short: "s", long: czPlural(left?.s ?? 0, ["sekunda", "sekundy", "sekund"]), pad: true },
  ];
  // no lone word on the last line ("…končí / za")
  const label = next.label.replace(/ (\S+)$/, "\u00a0$1");
  const digits = (p: (typeof parts)[number]) => (p.n === undefined ? "–" : p.pad ? two(p.n) : String(p.n));
  const spoken = left ? `${left.d} ${parts[0].long}, ${left.h} ${parts[1].long}, ${left.m} ${parts[2].long}` : undefined;

  if (variant === "bar")
    return (
      <span role="timer" aria-label={spoken && `${next.label} ${spoken}`.trim()} className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {label && <span className="text-xs font-semibold">{label}</span>}
        {parts.map((p) => (
          <span key={p.short} className="rounded-md bg-les/10 px-1.5 py-0.5 text-xs font-bold tabular-nums">
            {digits(p)}&nbsp;{p.short}
          </span>
        ))}
      </span>
    );

  return (
    <div role="timer" aria-label={spoken && `${next.label} ${spoken}`.trim()}>
      {label && <p className="mb-2.5 text-sm font-semibold text-les/80">{label}</p>}
      <div className="grid grid-cols-4 gap-2">
        {parts.map((p) => (
          <div key={p.short} className="rounded-xl bg-les px-1 py-2.5 text-center shadow-[0_8px_20px_-12px_rgba(21,26,19,.8)]">
            <div className="text-2xl font-bold tabular-nums text-zlato-light sm:text-3xl">{digits(p)}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-papir/70">{p.n === undefined ? p.short : p.long}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
