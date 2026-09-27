import sanitizeHtml from "sanitize-html";

/** Rich texts are stored as HTML (from the editor); older ones as light markdown. */
export const isHtml = (text: string) => /^\s*<(p|h[1-6]|ul|ol|blockquote|div|br|strong|em)\b/i.test(text);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text: string) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1">$1</a>');
}

/** Legacy light markdown (## nadpis, - odrážka, > citace, **tučně**) → HTML. */
export function legacyToHtml(text: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    if (quote.length) out.push(`<blockquote><p>${quote.map(inline).join("<br>")}</p></blockquote>`);
    para = [];
    list = [];
    quote = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^#{1,3}\s+(.*)$/.exec(line);
    const li = /^[-•*]\s+(.*)$/.exec(line);
    const q = /^>\s?(.*)$/.exec(line);
    if (h) {
      flush();
      out.push(`<h2>${inline(h[1])}</h2>`);
    } else if (li) {
      if (para.length || quote.length) flush();
      list.push(li[1]);
    } else if (q) {
      if (para.length || list.length) flush();
      quote.push(q[1]);
    } else {
      if (list.length || quote.length) flush();
      para.push(line);
    }
  }
  flush();
  return out.join("");
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: (_tag, attribs) => {
      const href = attribs.href ?? "#";
      const out: sanitizeHtml.Attributes = { href };
      if (/^https?:/i.test(href)) Object.assign(out, { target: "_blank", rel: "noopener noreferrer" });
      return { tagName: "a", attribs: out };
    },
    h1: "h2",
    h4: "h3",
  },
};

/** Any stored rich text (HTML or legacy markdown) → safe HTML. */
export function toSafeHtml(text: string): string {
  if (!text.trim()) return "";
  return sanitizeHtml(isHtml(text) ? text : legacyToHtml(text), OPTIONS).trim();
}
