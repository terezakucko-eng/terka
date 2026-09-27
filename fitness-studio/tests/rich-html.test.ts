import { describe, expect, it } from "vitest";
import { legacyToHtml, toSafeHtml } from "@/lib/rich-html";

describe("rich text", () => {
  it("converts the old markdown-like texts", () => {
    const text = [
      "## Ahoj, tady tvoje lektorka.",
      "**Každý má svou cestu.** Od dětství jsem v piruetě.",
      "",
      "- tanec",
      "- pilates",
      "> „Kdo chce, hledá způsoby.“",
    ].join("\n");
    expect(legacyToHtml(text)).toBe(
      "<h2>Ahoj, tady tvoje lektorka.</h2>" +
        "<p><strong>Každý má svou cestu.</strong> Od dětství jsem v piruetě.</p>" +
        "<ul><li>tanec</li><li>pilates</li></ul>" +
        "<blockquote><p>„Kdo chce, hledá způsoby.“</p></blockquote>",
    );
  });

  it("keeps editor HTML and strips anything dangerous", () => {
    const html =
      '<p>Ahoj <strong>ty</strong> <a href="https://x.cz" onclick="evil()">odkaz</a></p>' +
      '<script>alert(1)</script><p><a href="javascript:alert(1)">zlé</a><img src=x onerror=alert(1)></p>';
    const safe = toSafeHtml(html);
    expect(safe).toContain('<a href="https://x.cz" target="_blank" rel="noopener noreferrer">odkaz</a>');
    expect(safe).not.toMatch(/script|onclick|onerror|javascript|<img/);
  });

  it("escapes HTML typed into old plain texts", () => {
    expect(toSafeHtml("Věk < 18 & <b>x</b>")).toBe("<p>Věk &lt; 18 &amp; &lt;b&gt;x&lt;/b&gt;</p>");
  });
});
