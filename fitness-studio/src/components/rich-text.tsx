import { toSafeHtml } from "@/lib/rich-html";
import { cx } from "./ui";

/** Renders an admin-edited rich text (sanitized HTML, legacy markdown converted). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const html = toSafeHtml(text);
  if (!html) return null;
  return <div className={cx("rich", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
