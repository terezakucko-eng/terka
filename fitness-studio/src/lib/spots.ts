import { pluralCs } from "@/lib/money";

/** The URL of one class (/rozvrh/<id>) – the bar and the pop-up can show its free places live. */
export const SESSION_URL = /^(?:https?:\/\/[^/]+)?\/rozvrh\/([0-9a-f-]{36})\/?(?:[?#].*)?$/i;

export const sessionOf = (href: string) => href.match(SESSION_URL)?.[1];

/** „Zbývají už jen 3 místa!“ – recounted on every page view, so it's always true. */
export function spotsHint(n: number) {
  if (n === 0) return "Obsazeno – zapiš se mezi náhradníky";
  if (n === 1) return "Zbývá poslední místo!";
  if (n <= 4) return `Zbývají už jen ${n} místa!`;
  return `Zbývá ${pluralCs(n, "volné místo", "volná místa", "volných míst")}`;
}

/** Answers like „ano“ in the content fields. */
export const isYes = (v: string) => /^(ano|a|yes|1)$/i.test(v.trim());
