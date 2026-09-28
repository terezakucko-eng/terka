/** Octopus avatars to pick from (public/avatars/octo-N.svg, drawn by scripts/octo-avatars.py). */
export const OCTO_AVATARS = Array.from({ length: 12 }, (_, i) => `octo:${i + 1}`);
/** Emoji avatars offered earlier – still shown for clients who picked one. */
export const AVATAR_EMOJI = ["🐙", "🌿", "🌸", "☀️", "🌊", "🦋", "🔥", "🌙", "🍀", "💪", "🧘", "✨"] as const;

export const MONTHS = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
] as const;

type Named = { name: string; nickname?: string | null };

/** What we call the client in public places (board) – nickname, else first name. */
export const displayName = (u: Named) => u.nickname?.trim() || u.name.split(" ")[0];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export type AvatarValue = { kind: "photo"; url: string } | { kind: "emoji"; emoji: string } | { kind: "initials" };

export function parseAvatar(v: string | null | undefined): AvatarValue {
  if (v?.startsWith("/media/")) return { kind: "photo", url: v };
  if (v && OCTO_AVATARS.includes(v)) return { kind: "photo", url: `/avatars/octo-${v.slice(5)}.svg` };
  if (v?.startsWith("emoji:")) return { kind: "emoji", emoji: v.slice(6) };
  return { kind: "initials" };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" from a date input, only real past dates; else null. */
export function cleanBirthDate(v: string, today = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  if (d > today || d.getUTCFullYear() < 1900) return null;
  return v;
}

/** "MM-DD" from day + month selects; else null. */
export function cleanNameDay(day: number | null, month: number | null): string | null {
  if (!day || !month || month < 1 || month > 12) return null;
  const max = new Date(Date.UTC(2024, month, 0)).getUTCDate(); // leap year allows 29. 2.
  if (day < 1 || day > max) return null;
  return `${pad(month)}-${pad(day)}`;
}

/** "12. března" */
export function formatDayMonth(mmdd: string) {
  const [m, d] = mmdd.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]}`;
}

type Celebrant = Named & { id: string; birthDate: string | null; nameDay: string | null };
export type Celebration<U> = { user: U; kind: "birthday" | "nameday"; date: string; age?: number };

/**
 * Birthdays and name days in the `days` days starting at `from` ("YYYY-MM-DD", Prague date),
 * soonest first. 29. 2. birthdays are celebrated on 28. 2. in non-leap years.
 */
export function upcomingCelebrations<U extends Celebrant>(list: U[], from: string, days = 7): Celebration<U>[] {
  const start = new Date(`${from}T12:00:00Z`);
  const window = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const leap = (y: number) => new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;
  const out: Celebration<U>[] = [];
  for (const date of window) {
    const y = Number(date.slice(0, 4));
    const mmdd = date.slice(5);
    for (const u of list) {
      if (u.birthDate) {
        let b = u.birthDate.slice(5);
        if (b === "02-29" && !leap(y)) b = "02-28";
        if (b === mmdd) out.push({ user: u, kind: "birthday", date, age: y - Number(u.birthDate.slice(0, 4)) });
      }
      if (u.nameDay === mmdd) out.push({ user: u, kind: "nameday", date });
    }
  }
  return out;
}
