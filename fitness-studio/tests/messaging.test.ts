import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campaignMessages, campaigns, entitlements, users } from "@/db/schema";
import {
  audienceRecipients,
  personalize,
  processCampaign,
  startCampaign,
  unsubscribe,
  type Sender,
} from "@/domain/campaigns";
import { detectMapping, importClients, interpretRows, parseCsv } from "@/domain/import";
import { grantEntitlement } from "@/domain/users";
import { normalizePhone } from "@/lib/phone";
import { smsParts } from "@/lib/newsletter";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("phone & sms", () => {
  it("normalizes Czech numbers", () => {
    expect(normalizePhone("777 123 456")).toBe("+420777123456");
    expect(normalizePhone("00420 777-123-456")).toBe("+420777123456");
    expect(normalizePhone("+421 905 123 456")).toBe("+421905123456");
    expect(normalizePhone("abc")).toBeNull();
  });
  it("counts SMS parts", () => {
    expect(smsParts("a".repeat(160)).parts).toBe(1);
    expect(smsParts("č".repeat(71)).parts).toBe(2);
  });
});

describe("campaigns", () => {
  it("respects consent and segment, sends in batches, unsubscribes", async () => {
    const a = await makeUser(h.db);
    const b = await makeUser(h.db);
    const c = await makeUser(h.db);
    await h.db.update(users).set({ marketingConsent: true }).where(eq(users.id, a.id));
    await h.db.update(users).set({ marketingConsent: true }).where(eq(users.id, b.id));
    await grantEntitlement(h.db, { userId: a.id, kind: "membership", name: "Č", entries: null, validityDays: 30 }, new Date());

    const members = await audienceRecipients(h.db, { channel: "email", purpose: "marketing", audience: { segment: "members" } });
    expect(members.map((m) => m.id)).toEqual([a.id]);
    const all = await audienceRecipients(h.db, { channel: "email", purpose: "marketing", audience: { segment: "all" } });
    expect(all.map((m) => m.id)).not.toContain(c.id);
    const service = await audienceRecipients(h.db, { channel: "email", purpose: "service", audience: { segment: "all" } });
    expect(service.map((m) => m.id)).toContain(c.id);

    const [camp] = await h.db
      .insert(campaigns)
      .values({ channel: "email", name: "Test", subject: "Ahoj", body: "Ahoj {{jmeno}}", audience: { segment: "all" } })
      .returning();
    const started = await startCampaign(h.db, camp.id);
    expect(started.recipientCount).toBeGreaterThanOrEqual(2);

    const seen: string[] = [];
    const sender: Sender = {
      email: async (msgs) => msgs.map((m) => (seen.push(personalize("{{jmeno}}", m.r, m.unsubscribeUrl)), { ok: true as const })),
      single: async () => ({ ok: true as const }),
    };
    let r = await processCampaign(h.db, camp.id, sender, (t) => `/o/${t}`, 1);
    expect(r.sent).toBe(1);
    while (r.remaining > 0) r = await processCampaign(h.db, camp.id, sender, (t) => `/o/${t}`, 1);
    const [done] = await h.db.select().from(campaigns).where(eq(campaigns.id, camp.id));
    expect(done.status).toBe("sent");
    expect(done.sentCount).toBe(started.recipientCount);
    expect(seen[0]).toMatch(/^Klient/);
    await expect(startCampaign(h.db, camp.id)).rejects.toThrow(/odeslána/);

    const [ua] = await h.db.select().from(users).where(eq(users.id, a.id));
    expect(await unsubscribe(h.db, ua.unsubscribeToken, ["email"])).toBe(true);
    const after = await audienceRecipients(h.db, { channel: "email", purpose: "marketing", audience: { segment: "all" } });
    expect(after.map((m) => m.id)).not.toContain(a.id);
    const msgs = await h.db.select().from(campaignMessages).where(eq(campaignMessages.campaignId, camp.id));
    expect(msgs.every((m) => m.status === "sent")).toBe(true);
  });
});

describe("import", () => {
  const csv =
    "Jméno;Příjmení;E-mail;Telefon;Kredit;Zbývající vstupy;Platnost do;Newsletter\n" +
    'Jana;Nová;JANA@example.cz;777 111 222;3;5;31.12.2099;ano\n' +
    "Petr;Bez;;777000000;0;0;;ne\n" +
    '"Eva, ml.";Stará;eva@example.cz;;0;0;;\n';

  it("parses, maps and imports idempotently", async () => {
    const rows = parseCsv(csv);
    const map = detectMapping(rows[0]);
    expect(map.email).toBe(2);
    expect(map.entries).toBe(5);
    const data = interpretRows(rows.slice(1), map);
    expect(data[0]).toMatchObject({ name: "Jana Nová", email: "jana@example.cz", phone: "+420777111222", credits: 3, entries: 5, newsletter: true });
    expect(data[1].problem).toMatch(/chybí e-mail/);
    expect(data[2].name).toBe("Eva, ml. Stará");

    const r1 = await importClients(h.db, data, { consentFromFile: true }, NOW);
    expect(r1).toMatchObject({ created: 2, updated: 0, credits: 3, passes: 1 });
    expect(r1.skipped).toHaveLength(1);
    const r2 = await importClients(h.db, data, { consentFromFile: true }, NOW);
    expect(r2).toMatchObject({ created: 0, updated: 2, credits: 0, passes: 0 });

    const [jana] = await h.db.select().from(users).where(eq(users.email, "jana@example.cz"));
    expect(jana.creditBalance).toBe(3);
    expect(jana.marketingConsent).toBe(true);
    expect(jana.passwordHash).toBe("!imported");
    const ents = await h.db.select().from(entitlements).where(eq(entitlements.userId, jana.id));
    expect(ents[0].entriesTotal).toBe(5);
  });
});
