const NB = "\u00A0";
// single-letter prepositions/conjunctions must not end a line (Czech typography)
const SINGLE = /(?<=^|[\s\u00A0(\[„“"'])([KkSsVvZzOoUuAaIi])[ \t]+(?=\S|$)/g;
// a number stays with its unit, a dash never starts a line
const UNIT = /(\d)[ \t]+(?=(Kč|%|×|min|h|dní|dnů|dny|den|měsíc|měsíce|měsíců|kredit|kredity|kreditů|vstup|vstupy|vstupů|lekce|lekcí|lekci|minut|let|osob|místo|místa|míst)(?![\p{L}\d]))/gu;
const DASH = /[ \t]+(?=[–—][ \t])/g;

function fixText(text: string) {
  return text.replace(SINGLE, `$1${NB}`).replace(UNIT, `$1${NB}`).replace(DASH, NB);
}

/** Inserts non-breaking spaces so lines don't end with „v“, „a“, a lone number or start with a dash. HTML tags are left untouched. */
export function nbsp(text: string): string;
export function nbsp(text: string | null | undefined): string | null | undefined;
export function nbsp(text: string | null | undefined) {
  if (!text) return text;
  return text
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") && part.endsWith(">") ? part : fixText(part)))
    .join("");
}
