import { toSafeHtml } from "@/lib/rich-html";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** A post's rich text → plain lines (paragraphs, headings, "• " list items) for the stories image. */
export function storyLines(text: string): string[] {
  return toSafeHtml(text)
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && l !== "•");
}

/* The story is 1080 wide with 96 px margins; its middle (between the logo and the footer) is about 1090 px high.
   Satori shrinks what doesn't fit, so the text overlapped – the title and body are sized here to fit instead. */
const WIDTH = 888;
const MIDDLE = 1040;
/** Rough width of a character as a share of the font size – a little generous, so nothing overflows. */
const CHAR = { regular: 0.53, semibold: 0.58 };
const EMOJI = /\p{Extended_Pictographic}/u;

/** Characters per line at a font size. */
const perLine = (size: number, weight: keyof typeof CHAR) => Math.floor(WIDTH / (size * CHAR[weight]));

/** Width of a word in characters – an emoji takes two. */
const cols = (word: string) => [...word].reduce((n, ch) => n + (EMOJI.test(ch) ? 2 : 1), 0);

/** How many lines a text wraps into, word by word, at `max` characters per line. */
export function wrapCount(text: string, max: number): number {
  let lines = 1;
  let cur = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const len = cols(w);
    if (cur === 0) cur = len;
    else if (cur + 1 + len <= max) cur += 1 + len;
    else {
      lines++;
      cur = len;
    }
  }
  return lines;
}

export const STORY_BODY = { size: 42, lineHeight: 58, gap: 22 };
const TITLE_LINE = 1.08;
const DIVIDER = 108; // the gold line with its margins
const MORE = 76; // „Celé čti na nástěnce →“

/** Title size and the body lines that fit under it, so nothing overlaps the logo or the footer. */
export function storyLayout(title: string, body: string[]): { titleSize: number; lines: string[]; cut: boolean } {
  const titleSize = [110, 92, 76].find((s) => wrapCount(title, perLine(s, "semibold")) <= 3) ?? 64;
  const titleHeight = wrapCount(title, perLine(titleSize, "semibold")) * titleSize * TITLE_LINE;
  const room = MIDDLE - titleHeight - DIVIDER - MORE;
  const max = perLine(STORY_BODY.size, "regular");
  const out: string[] = [];
  let used = 0;
  for (const l of body) {
    const gap = out.length ? STORY_BODY.gap : 0;
    const h = wrapCount(l, max) * STORY_BODY.lineHeight + gap;
    if (used + h <= room) {
      out.push(l);
      used += h;
      continue;
    }
    // what's left of the room: as many words of this line as fit, then an ellipsis
    const fit = Math.floor((room - used - gap) / STORY_BODY.lineHeight);
    if (fit >= 1) {
      const words = l.split(" ");
      let n = words.length;
      while (n > 0 && wrapCount(`${words.slice(0, n).join(" ")}…`, max) > fit) n--;
      if (n > 0) out.push(`${words.slice(0, n).join(" ")}…`);
    }
    return { titleSize, lines: out, cut: true };
  }
  return { titleSize, lines: out, cut: false };
}

