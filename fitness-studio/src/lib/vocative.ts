/**
 * Czech vocative (5. pád) of a first name – "Ahoj, Terezo", "Ahoj, Petře".
 * Rule-based: covers the common Czech names and diminutives; anything unusual
 * is returned unchanged, which still reads fine ("Ahoj, Naomi").
 */

/** Female names ending in a consonant – they don't change. */
const FEMININE_CONSONANT = new Set([
  "miriam", "ester", "karin", "karen", "dagmar", "ingrid", "carmen", "ruth", "rut", "nikol", "nicol",
  "rachel", "isabel", "mabel", "ellen", "vivien", "jasmin", "beatrix", "agnes", "abigail", "margit",
  "edit", "judit", "irmgard", "gudrun", "sigrid", "astrid", "elisabeth", "elizabeth", "lilian", "kim",
  "marion", "doris", "iris", "gwen", "jennifer", "kristen", "megan", "ann", "rosemary", "yasmin",
]);

/** Irregular or ambiguous male names. */
const SPECIAL: Record<string, string> = {
  pavel: "Pavle",
  karel: "Karle",
  marcel: "Marceli",
  daniel: "Danieli",
  michael: "Michaeli",
  gabriel: "Gabrieli",
  samuel: "Samueli",
  emanuel: "Emanueli",
  rafael: "Rafaeli",
  ezechiel: "Ezechieli",
  hugo: "Hugo",
  kuba: "Kubo",
  bob: "Bobe",
};

const matchCase = (source: string, out: string) =>
  source === source.toUpperCase() && source.length > 1 ? out.toUpperCase() : out;

export function vocative(name: string): string {
  const n = name.trim();
  if (!n || !/^[\p{L}'’-]+$/u.test(n)) return n;
  const lower = n.toLowerCase();
  const last = lower.at(-1)!;
  const stem = (k: number) => n.slice(0, n.length - k);

  if (SPECIAL[lower]) return matchCase(n, SPECIAL[lower]);
  if (FEMININE_CONSONANT.has(lower)) return n;

  // Tereza → Terezo, Jirka → Jirko, Honza → Honzo
  if (last === "a") return stem(1) + "o";
  // Marie, Lucie, Nelly, Jiří, René, Marko, Naomi…
  if ("eěiíyýoóuůúéá".includes(last)) return n;

  // Zdeněk → Zdeňku, Radek → Radku, Marek → Marku (movable e)
  if (/[dtn]ěk$/.test(lower)) return stem(3) + { d: "ď", t: "ť", n: "ň" }[lower.at(-3) as "d"] + "ku";
  if (/[^aeiouyáéíóúůý]ek$/.test(lower) && lower.length > 4) return stem(2) + "ku";
  // Dominik → Dominiku, Vojtěch → Vojtěchu, Oleg → Olegu
  if (/(k|h|ch|g)$/.test(lower)) return n + "u";
  // Petr → Petře, Alexandr → Alexandře; Igor → Igore
  if (last === "r") return /[aeiouyáéíóúůý]r$/.test(lower) ? n + "e" : stem(1) + "ře";
  // Tomáš → Tomáši, Matěj → Matěji, Alex → Alexi, Denis → Denisi
  if ("šžčřcjxsz".includes(last)) return n + "i";
  // Jan → Jane, Adam → Adame, David → Davide, Michal → Michale, Filip → Filipe
  if ("lnmdtbpvf".includes(last)) return n + "e";
  return n;
}

/** Vocative of the first word of a full name: "Tereza Nováková" → "Terezo". */
export const greetName = (fullName: string) => vocative(fullName.trim().split(/\s+/)[0] ?? "");
