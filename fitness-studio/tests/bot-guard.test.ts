import { describe, expect, it } from "vitest";
import { HONEYPOT, STAMP, dottedGmail, formStamp, gibberishName, looksLikeBot, stampOk } from "@/lib/bot-guard";

const T = Date.parse("2026-10-04T09:00:00Z");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("bot guard", () => {
  it("stamp must be genuine and the form must not be sent too fast or too late", () => {
    const s = formStamp(T);
    expect(stampOk(s, T + 10_000)).toBe(true);
    expect(stampOk(s, T + 1_000)).toBe(false);
    expect(stampOk(s, T + 25 * 3_600_000)).toBe(false);
    expect(stampOk(`${T}.deadbeef`, T + 10_000)).toBe(false);
    expect(stampOk("", T)).toBe(false);
  });

  it("spots random-letter names and dotted Gmail addresses", () => {
    expect(gibberishName("jzTeFvVbtGUGxqKTtDNyCJ")).toBe(true);
    expect(gibberishName("Jana Kereškéni")).toBe(false);
    expect(gibberishName("Klára Chudá")).toBe(false);
    expect(gibberishName("Anna-Marie McDonaldová")).toBe(false);
    expect(dottedGmail("hl.ew.isj.ac.k.so.n@gmail.com")).toBe(true);
    expect(dottedGmail("jana.novakova@gmail.com")).toBe(false);
    expect(dottedGmail("a.b.c.d@seznam.cz")).toBe(false);
  });

  it("passes a normal sign-up and stops a filled honeypot or a missing stamp", () => {
    const ok = { name: "Klára Chudá", email: "klara@seznam.cz", [STAMP]: formStamp(T) };
    expect(looksLikeBot(form(ok), T + 20_000)).toBe(false);
    expect(looksLikeBot(form({ ...ok, [HONEYPOT]: "http://spam" }), T + 20_000)).toBe(true);
    expect(looksLikeBot(form({ name: ok.name, email: ok.email }), T + 20_000)).toBe(true);
    expect(looksLikeBot(form({ ...ok, name: "jzTeFvVbtGUGxqKTtDNyCJ" }), T + 20_000)).toBe(true);
  });
});
