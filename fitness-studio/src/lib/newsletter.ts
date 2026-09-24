import { site } from "@/config/site";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text with light formatting → e-mail HTML (paragraphs, **tučně**, # nadpis, odkazy). */
function bodyToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      let h = esc(block)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#674329">$1</a>')
        .replace(/\n/g, "<br>");
      if (h.startsWith("# ")) {
        h = h.slice(2);
        return `<h2 style="margin:8px 0 16px;font-size:22px;font-weight:500;color:#151a13">${h}</h2>`;
      }
      return `<p style="margin:0 0 16px;line-height:1.6">${h}</p>`;
    })
    .join("");
}

/** Branded newsletter e-mail in the OCTOPUSH style. */
export function renderNewsletter(opts: {
  subject: string;
  body: string;
  unsubscribeUrl: string;
  /** "Firma · adresa" line in the footer */
  footer: string;
}) {
  const logo = `${site.url}/brand/email-logo.png`;
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.subject)}</title></head>
<body style="margin:0;background:#f3ebde;font-family:Helvetica,Arial,sans-serif;color:#151a13">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ebde"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td align="center" style="background:#1a281b;padding:28px"><img src="${logo}" width="180" alt="${site.name}" style="display:block;width:180px;height:auto"></td></tr>
<tr><td style="background:#fffaf2;padding:36px 32px;font-size:16px">${bodyToHtml(opts.body)}</td></tr>
<tr><td align="center" style="padding:24px;font-size:12px;color:#606350;letter-spacing:.2em;text-transform:uppercase">${esc(site.tagline)}</td></tr>
<tr><td align="center" style="padding:0 24px 24px;font-size:12px;color:#606350;line-height:1.6">
${esc(opts.footer)}<br>
Tento e-mail dostáváš, protože jsi souhlasil/a se zasíláním novinek. <a href="${opts.unsubscribeUrl}" style="color:#674329">Odhlásit odběr</a>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${opts.body}\n\n—\n${site.name} · ${site.tagline}\nOdhlásit odběr: ${opts.unsubscribeUrl}`;
  return { html, text };
}

/** GSM-7 SMS = 160 chars (153 per part), with diacritics (UCS-2) 70 (67 per part). */
export function smsParts(text: string) {
  const unicode = /[^\x00-\x7F]/.test(text);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  const parts = text.length <= single ? 1 : Math.ceil(text.length / multi);
  return { length: text.length, unicode, parts };
}
