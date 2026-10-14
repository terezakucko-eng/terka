import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { to: string; id: string; vars: Record<string, string> }[] = [];
vi.mock("@/lib/email-templates", () => ({
  sendEmail: vi.fn(async (to: string, id: string, vars: Record<string, string>) => void sent.push({ to, id, vars })),
}));
vi.mock("@/lib/push", () => ({ pushQuietly: vi.fn(async () => 0) }));

const { entitlements, users } = await import("@/db/schema");
const { linkReferral, myReferrals, referralInfo, referrerByCode } = await import("@/domain/referrals");
const { createProductOrder, fulfillOrder, sellAtReception } = await import("@/domain/orders");
const { sendReferralThanks } = await import("@/lib/notify");
const { saveSettings } = await import("@/lib/settings");
const { NOW, makeProduct, makeUser, testDb } = await import("./helpers");

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());
beforeEach(() => void (sent.length = 0));

const gifts = (userId: string) =>
  h.db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.name, "Lekce zdarma za pozvání 💛")));

describe("Pozvi kamarádku", () => {
  it("links the friend at sign-up and rewards the first payment once", async () => {
    const jana = await makeUser(h.db);
    const petra = await makeUser(h.db);
    await h.db.update(users).set({ nickname: "Janička" }).where(eq(users.id, jana.id));
    expect(jana.referralCode).toMatch(/^[0-9a-f]{10}$/);
    expect(await referrerByCode(h.db, jana.referralCode)).toEqual({ id: jana.id, name: "Janička" });
    expect(await referrerByCode(h.db, "nope")).toBeNull();

    expect(await linkReferral(h.db, jana.id, jana.referralCode)).toBe(false); // not herself
    expect(await linkReferral(h.db, petra.id, "0000000000")).toBe(false);
    expect(await linkReferral(h.db, petra.id, jana.referralCode)).toBe(true);
    expect(await linkReferral(h.db, petra.id, jana.referralCode)).toBe(false); // only once
    expect(await myReferrals(h.db, jana.id)).toEqual([expect.objectContaining({ name: "Klient", rewarded: false })]);

    const pass = await makeProduct(h.db, { kind: "pass", entries: 10, validityDays: 90 });
    const { order } = await createProductOrder(h.db, { userId: petra.id, productId: pass.id }, NOW);
    await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
    const [gift] = await gifts(jana.id);
    expect(gift).toMatchObject({ kind: "free", entriesTotal: 1 });
    expect(gift.validUntil.getTime() - NOW.getTime()).toBe(60 * 86_400_000);
    expect((await myReferrals(h.db, jana.id))[0].rewarded).toBe(true);
    expect(await referralInfo(h.db, petra.id)).toMatchObject({ invitedBy: { id: jana.id } });

    // a second purchase gives nothing more
    await sellAtReception(h.db, { userId: petra.id, productId: pass.id }, NOW);
    expect(await gifts(jana.id)).toHaveLength(1);

    // the thank-you goes out once
    expect(await sendReferralThanks(h.db, NOW)).toBe(1);
    expect(sent[0]).toMatchObject({ to: jana.email, id: "referralReward" });
    expect(sent[0].vars.platnost).toBe("4. 12. 2026");
    expect(await sendReferralThanks(h.db, NOW)).toBe(0);
  });

  it("gives nothing when switched off or for a free order", async () => {
    const a = await makeUser(h.db);
    const b = await makeUser(h.db);
    await linkReferral(h.db, b.id, a.referralCode);
    const free = await makeProduct(h.db, { kind: "pass", entries: 1, validityDays: 30, price: 0 });
    await sellAtReception(h.db, { userId: b.id, productId: free.id }, NOW);
    expect(await gifts(a.id)).toHaveLength(0);
    await saveSettings(h.db, { referralGiftEntries: 0 });
    const paid = await makeProduct(h.db, { kind: "pass", entries: 1, validityDays: 30 });
    await sellAtReception(h.db, { userId: b.id, productId: paid.id }, NOW);
    expect(await gifts(a.id)).toHaveLength(0);
    await saveSettings(h.db, { referralGiftEntries: 1 });
  });
});
