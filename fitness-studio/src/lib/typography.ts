const NB = "\u00A0";
// prepositions and conjunctions must not end a line (Czech typography) – the
// single-letter ones and the short ones the studio wants kept with the next word too
const SHORT_WORDS = "a|i|k|o|s|u|v|z|na|do|od|po|za|ze|ke|ku|ve|pro|při|nad|pod|před|přes|bez|ale|ani|či|nebo";
const SHORT = new RegExp(`(?<=^|[\\s\\u00A0(\\[„“"'])(${SHORT_WORDS})[ \\t]+(?=\\S|$)`, "giu");
// a number stays with its unit, a dash never starts a line
const UNIT = /(\d)[ \t]+(?=(Kč|%|×|min|h|dní|dnů|dny|den|měsíc|měsíce|měsíců|kredit|kredity|kreditů|vstup|vstupy|vstupů|lekce|lekcí|lekci|minut|let|osob|místo|místa|míst)(?![\p{L}\d]))/gu;
const DASH = /[ \t]+(?=[–—][ \t])/g;

function fixText(text: string) {
  return text.replace(SHORT, `$1${NB}`).replace(UNIT, `$1${NB}`).replace(DASH, NB);
}

/** Inserts non-breaking spaces so lines don't end with „v“, „a“, „na“, a lone number or start with a dash. HTML tags are left untouched. */
export function nbsp(text: string): string;
export function nbsp(text: string | null | undefined): string | null | undefined;
export function nbsp(text: string | null | undefined) {
  if (!text) return text;
  return text
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") && part.endsWith(">") ? part : fixText(part)))
    .join("");
}

/** Elements whose text is code or the user's own input – left exactly as written. */
const RAW = new Set(["script", "style", "code", "pre", "kbd", "samp", "textarea"]);

function typesetChild(child: unknown): unknown {
  if (typeof child === "string") return nbsp(child);
  if (Array.isArray(child)) {
    const out = child.map(typesetChild);
    return out.some((c, i) => c !== child[i]) ? out : child;
  }
  return child;
}

/**
 * Typesets the text of every HTML element on the web (used by the JSX runtime
 * in src/lib/jsx): its text children and placeholder/title. Components get
 * their props untouched – their text is typeset when it reaches an element.
 */
export function typesetProps<P>(type: unknown, props: P): P {
  if (typeof type !== "string" || RAW.has(type) || !props || typeof props !== "object") return props;
  const p = props as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  for (const key of ["children", "placeholder", "title"]) {
    if (!(key in p)) continue;
    const v = typesetChild(p[key]);
    if (v !== p[key]) (out ??= { ...p })[key] = v;
  }
  return (out ?? props) as P;
}
