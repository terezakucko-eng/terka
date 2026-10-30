import { toSafeHtml } from "@/lib/rich-html";
import { nbsp } from "@/lib/typography";
import { cx } from "./ui";

/** A paragraph that is just a link becomes a button (board posts: „👉 Do ceníku“). */
export const withButtons = (html: string) => html.replace(/<p>\s*<a ([^>]*)>([\s\S]*?)<\/a>\s*<\/p>/g, '<p><a class="cta" $1>$2</a></p>');

/** Renders an admin-edited rich text (sanitized HTML, legacy markdown converted). */
export function RichText({ text, className, buttons = false }: { text: string; className?: string; buttons?: boolean }) {
  const safe = nbsp(toSafeHtml(text));
  const html = buttons ? withButtons(safe) : safe;
  if (!html) return null;
  return <div className={cx("rich", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
