import { pragueLocalToDate } from "@/lib/dates";

/** One end of a countdown: the instant (ms) and what the countdown says before the digits. */
export type Deadline = { at: number; label: string };

const nextDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * The countdown field of the bar or the pop-up (Obsah webu): one end per line, Prague time,
 * a label after a vertical bar – "2026-11-30 | zbývá" or "2026-11-30 18:00 | Přihlášky končí za".
 * A bare date counts to the end of that day. Lines that aren't a date are left out; earliest first.
 */
export function parseCountdown(text: string): Deadline[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?\s*(?:\|\s*(.*))?$/.exec(line.trim());
      if (!m) return [];
      const [, day, hh, mm, label] = m;
      const at = hh ? pragueLocalToDate(`${day}T${hh.padStart(2, "0")}:${mm}`) : pragueLocalToDate(`${nextDay(day)}T00:00`);
      return Number.isNaN(at.getTime()) ? [] : [{ at: at.getTime(), label: (label ?? "").trim() }];
    })
    .sort((a, b) => a.at - b.at);
}

/** The ends still ahead – only these go to the browser. */
export const upcomingDeadlines = (text: string, now = new Date()) => parseCountdown(text).filter((d) => d.at > now.getTime());

/** The end counted down to now – the first one still ahead; none = the countdown is over. */
export const nextDeadline = (list: Deadline[], now: number) => list.find((d) => d.at > now) ?? null;

/** Time left as days, hours, minutes and seconds (never below zero). */
export function splitTime(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86_400), h: Math.floor((t % 86_400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

/** Czech plural: 1 den, 2–4 dny, 5 dní (and 0 dní). */
export const czPlural = (n: number, [one, few, many]: [string, string, string]) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
