/** All studio times are Europe/Prague; the database stores UTC instants. */
export const TZ = "Europe/Prague";
const DAY = 86_400_000;

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function pragueParts(d: Date) {
  const p = Object.fromEntries(
    partsFmt.formatToParts(d).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    min: Number(p.minute),
    s: Number(p.second),
  };
}

/** Prague offset from UTC (ms) at the given instant. */
function offsetAt(d: Date) {
  const p = pragueParts(d);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-10-05T18:00" (Prague wall time) → Date */
export function pragueLocalToDate(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(local);
  if (!m) throw new Error(`Neplatné datum: ${local}`);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  const off1 = offsetAt(new Date(guess));
  let ts = guess - off1;
  const off2 = offsetAt(new Date(ts));
  if (off2 !== off1) ts = guess - off2;
  return new Date(ts);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DD" in Prague */
export function dateKey(d: Date): string {
  const p = pragueParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Date → "YYYY-MM-DDTHH:mm" in Prague (value for <input type="datetime-local">) */
export function toLocalInput(d: Date): string {
  const p = pragueParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

/** Calendar arithmetic on "YYYY-MM-DD" keys. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = pondělí … 6 = neděle */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(key: string): string {
  return addDays(key, -weekdayOf(key));
}

export function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** [start, end) of the Prague week containing the instant */
export function weekRange(d: Date) {
  const monday = mondayOf(dateKey(d));
  return {
    start: pragueLocalToDate(monday),
    end: pragueLocalToDate(addDays(monday, 7)),
  };
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("cs-CZ", { timeZone: TZ, ...opts });

const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const dayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const shortDayFmt = fmt({ weekday: "short", day: "numeric", month: "numeric" });
const dateFmt = fmt({ day: "numeric", month: "numeric", year: "numeric" });
const dateTimeFmt = fmt({
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDay = (d: Date) => dayFmt.format(d);
export const formatShortDay = (d: Date) => shortDayFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);

export function formatRange(start: Date, durationMin: number) {
  return `${formatTime(start)} – ${formatTime(new Date(start.getTime() + durationMin * 60_000))}`;
}

export const WEEKDAYS = [
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
  "Neděle",
];
