/**
 * The pop-up shows once per content version; with a repeat weekday it comes back
 * on that day (once that day) even for visitors who closed it before.
 */

const DAYS: [string, number][] = [["po", 1], ["ut", 2], ["st", 3], ["ct", 4], ["pa", 5], ["so", 6], ["ne", 0]];

/** "středa", "ve středu", "St" → 3 (JS weekday, 0 = Sunday); anything else → null. */
export function weekdayIndex(text: string): number | null {
  const s = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^ve?\s+/, "");
  if (!s) return null;
  return DAYS.find(([p]) => s.startsWith(p))?.[1] ?? null;
}

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** What the browser remembers after closing: the version and the day it was closed. */
export function seenValue(id: string, now = new Date()) {
  return JSON.stringify({ id, on: localDay(now) });
}

/** Should the pop-up show, given what the browser remembers (older visits stored just the version)? */
export function popupDue(stored: string | null, id: string, repeatDay: number | null, now = new Date()) {
  let seenId = stored;
  let on: string | null = null;
  try {
    const v = JSON.parse(stored ?? "");
    if (v && typeof v === "object") ({ id: seenId, on } = v);
  } catch {}
  if (seenId !== id) return true;
  return repeatDay !== null && now.getDay() === repeatDay && on !== localDay(now);
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Which pop-up shows today: the next one (Další vyskakovací okno) from its date on, else the current one. */
export function popupSlot(next: { title: string; from: string }, today: string): "popup" | "popupNext" {
  return next.title.trim() && isDate(next.from.trim()) && today >= next.from.trim() ? "popupNext" : "popup";
}

/** The pop-up has ended (its "until" day is over). */
export const popupOver = (until: string, today: string) => isDate(until) && today > until;
