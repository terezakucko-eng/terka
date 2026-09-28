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

/** Keeps whole lines up to `max` characters; the rest is cut with an ellipsis. */
export function clampLines(lines: string[], max: number): { lines: string[]; cut: boolean } {
  const out: string[] = [];
  let left = max;
  for (const l of lines) {
    if (l.length <= left) {
      out.push(l);
      left -= l.length + 40; // a new line takes room too
      continue;
    }
    if (left > 60) out.push(`${l.slice(0, left).replace(/\s+\S*$/, "")}…`);
    return { lines: out, cut: true };
  }
  return { lines: out, cut: false };
}
