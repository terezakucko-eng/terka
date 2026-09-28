/** Helpers for Admin → Klienti: name split, Czech sorting and tags. */

/** "Tereza Nová" → { first: "Tereza", last: "Nová" }; the last word is the surname. */
export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1)! };
}

export const TAGS = {
  membership: "Členství",
  pass: "Permanentka",
  credit: "Kredit",
  massage_pass: "Masáže",
  solarium: "Solárium",
  free: "Vstup zdarma",
  paused: "Pauza",
  noPassword: "Nepřihlášen",
} as const;

export type Tag = keyof typeof TAGS;

export const SORTS = { prijmeni: "Příjmení", jmeno: "Jméno", kredit: "Kredit", registrace: "Registrace" } as const;
export type Sort = keyof typeof SORTS;

const collator = new Intl.Collator("cs", { sensitivity: "base" });

export function sortClients<T extends { name: string; createdAt: Date; creditBalance: number }>(list: T[], sort: Sort): T[] {
  const byName = (key: "first" | "last") => (a: T, b: T) => {
    const x = splitName(a.name), y = splitName(b.name);
    const other = key === "last" ? "first" : "last";
    return collator.compare(x[key] || x[other], y[key] || y[other]) || collator.compare(x[other], y[other]);
  };
  const copy = [...list];
  if (sort === "registrace") return copy.sort((a, b) => +b.createdAt - +a.createdAt);
  if (sort === "kredit") return copy.sort((a, b) => b.creditBalance - a.creditBalance || byName("last")(a, b));
  return copy.sort(byName(sort === "jmeno" ? "first" : "last"));
}
