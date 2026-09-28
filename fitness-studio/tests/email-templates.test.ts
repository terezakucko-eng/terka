import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/content", () => ({ getContent: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));

const { EMAILS, composeEmail, emailKey, sampleVars } = await import("@/lib/email-templates");
const fill = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (m, k: string) => v[k] ?? m);

describe("automatic e-mail templates", () => {
  it("fills placeholders, drops empty optional lines and adds the signature", () => {
    const e = composeEmail("booked", { ...sampleVars("booked"), kamaradka: "", web: "https://www.octopush.fit" }, new Map(), (t, v) => fill(t, { web: "https://www.octopush.fit", ...v }));
    expect(e.subject).toBe("Rezervace potvrzena: Reformer – úterý 7. 10. v 18:00");
    expect(e.text).toMatch(/^Ahoj Terezo,\n\nmáš místo na lekci Reformer/);
    expect(e.text).not.toMatch(/\n{3,}/);
    expect(e.text).toMatch(/OCTOPUSH · Každý má svou cestu\.\nhttps:\/\/www\.octopush\.fit$/);
  });

  it("uses the edited text when saved", () => {
    const saved = new Map([[emailKey("welcome", "subject"), "Ahoj {{osloveni}}!"], [emailKey("signature", "body"), ""]]);
    const e = composeEmail("welcome", sampleVars("welcome"), saved, fill);
    expect(e.subject).toBe("Ahoj Terezo!");
    expect(e.text).toBe(fill(EMAILS.welcome.body, sampleVars("welcome")));
  });

  it("every placeholder in the defaults is documented", () => {
    const common = ["web", "firma", "email", "telefon", "adresa"];
    for (const [id, def] of Object.entries(EMAILS)) {
      const used = [...`${def.subject} ${def.body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      for (const u of used) expect([...Object.keys(def.vars), ...common], `${id}: {{${u}}}`).toContain(u);
    }
  });
});
