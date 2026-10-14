import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { to: string; id: string; vars: Record<string, string> }[] = [];
vi.mock("@/lib/email-templates", () => ({
  sendEmail: vi.fn(async (to: string, id: string, vars: Record<string, string>) => void sent.push({ to, id, vars })),
}));
vi.mock("@/lib/push", () => ({ pushQuietly: vi.fn(async () => 0) }));

const { entitlements, orders, users, vouchers } = await import("@/db/schema");
const v = await import("@/domain/vouchers");
const { abandonOrder, fulfillOrder } = await import("@/domain/orders");
const { deleteOrder } = await import("@/domain/cleanup");
const { deleteProduct } = await import("@/domain/catalog");
const { sendVoucherReady } = await import("@/lib/notify");
const { voucherPdf } = await import("@/lib/voucher-pdf");
const { PDFDocument } = await import("pdf-lib");
const { NOW, hours, makeProduct, makeUser, testDb } = await import("./helpers");

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());
beforeEach(() => void (sent.length = 0));

const DAY = 24;

describe("gift vouchers", () => {
  it("buys a price-list item, activates it on payment and redeems it once", async () => {
    const buyer = await makeUser(h.db);
    const friend = await makeUser(h.db);
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka 10", entries: 10, validityDays: 90, price: 210000 });
    await makeProduct(h.db, { kind: "membership", name: "Členství", price: 139000 });
    expect((await v.giftableProducts(h.db)).map((p) => p.kind)).not.toContain("membership");

    const { order, voucher } = await v.createVoucherOrder(h.db, buyer.id, { productId: pass.id, recipientName: " Jana ", message: "Všechno nejlepší!" }, NOW);
    expect(order).toMatchObject({ kind: "voucher", amount: 210000, description: "Dárkový poukaz – Permanentka 10" });
    expect(voucher).toMatchObject({ kind: "product", title: "Permanentka 10", recipientName: "Jana", buyerId: buyer.id });
    expect(voucher.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(v.voucherStatus(voucher, NOW)).toBe("pending");
    await expect(v.redeemVoucher(h.db, voucher.code, friend.id, NOW)).rejects.toThrow("není zaplacený");

    await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
    const [paid] = await h.db.select().from(vouchers).where(eq(vouchers.id, voucher.id));
    expect(v.voucherStatus(paid, NOW)).toBe("active");
    expect(paid.validUntil!.getTime() - NOW.getTime()).toBe(365 * DAY * 3_600_000);
    // the buyer got nothing for herself
    expect(await h.db.select().from(entitlements).where(eq(entitlements.userId, buyer.id))).toHaveLength(0);

    // typed with a dash and in lower case
    const typed = v.formatVoucherCode(voucher.code).toLowerCase();
    const done = await v.redeemVoucher(h.db, ` ${typed} `, friend.id, hours(1));
    expect(done.redeemedBy).toBe(friend.id);
    const [ent] = await h.db.select().from(entitlements).where(eq(entitlements.userId, friend.id));
    expect(ent).toMatchObject({ kind: "pass", name: "Permanentka 10", entriesTotal: 10, orderId: null });
    expect(ent.note).toContain("Dárkový poukaz");
    await expect(v.redeemVoucher(h.db, voucher.code, buyer.id, hours(2))).rejects.toThrow("už byl uplatněný");
    await expect(v.redeemVoucher(h.db, "AAAA-AAAA", buyer.id)).rejects.toThrow("neznáme");
    await expect(v.redeemVoucher(h.db, "abc", buyer.id)).rejects.toThrow("8 znaků");

    // a product someone has as a gift is archived, not deleted
    expect(await deleteProduct(h.db, pass.id)).toBe("archived");
  });

  it("an amount voucher gives credit at the set rate and expires", async () => {
    const buyer = await makeUser(h.db);
    const friend = await makeUser(h.db);
    await expect(v.createVoucherOrder(h.db, buyer.id, { amountKc: 50 }, NOW)).rejects.toThrow("mezi");
    const { order, voucher } = await v.createVoucherOrder(h.db, buyer.id, { amountKc: 1000 }, NOW);
    expect(voucher).toMatchObject({ kind: "amount", amount: 100000, credits: 1100 });
    expect(voucher.title).toMatch(/^Poukaz na 1\s000\sKč$/);
    await fulfillOrder(h.db, { orderId: order.id, provider: "reception" }, NOW);

    const late = new Date(NOW.getTime() + 366 * 86_400_000);
    await expect(v.redeemVoucher(h.db, voucher.code, friend.id, late)).rejects.toThrow("vypršela");
    await v.redeemVoucher(h.db, voucher.code, friend.id, hours(DAY));
    const [u] = await h.db.select().from(users).where(eq(users.id, friend.id));
    expect(u.creditBalance).toBe(1100);
    expect(u.creditExpiresAt!.getTime()).toBe(hours(DAY).getTime() + 365 * 86_400_000);
    expect(v.voucherContents(voucher)).toContain("1100 kreditů");
  });

  it("lists, notifies the buyer once and cancels with a deleted order", async () => {
    const buyer = await makeUser(h.db);
    const a = await v.createVoucherOrder(h.db, buyer.id, { amountKc: 500 }, NOW);
    const b = await v.createVoucherOrder(h.db, buyer.id, { amountKc: 700 }, NOW);
    const c = await v.createVoucherOrder(h.db, buyer.id, { amountKc: 900 }, NOW);
    await abandonOrder(h.db, c.order.id); // card checkout closed
    expect((await v.boughtVouchers(h.db, buyer.id)).map((x) => x.id).sort()).toEqual([a.voucher.id, b.voucher.id].sort());

    await sendVoucherReady(h.db, NOW); // the earlier tests' vouchers
    sent.length = 0;
    await fulfillOrder(h.db, { orderId: a.order.id, provider: "test" }, NOW);
    expect(await sendVoucherReady(h.db, NOW)).toBe(1);
    expect(sent[0]).toMatchObject({ to: buyer.email, id: "voucherReady" });
    expect(sent[0].vars.kod).toBe(v.formatVoucherCode(a.voucher.code));
    expect(await sendVoucherReady(h.db, NOW)).toBe(0);

    await deleteOrder(h.db, a.order.id, buyer.id);
    const [gone] = await h.db.select().from(vouchers).where(eq(vouchers.id, a.voucher.id));
    expect(v.voucherStatus(gone)).toBe("cancelled");
    expect(await h.db.select().from(orders).where(and(eq(orders.id, a.order.id)))).toHaveLength(0);
    await v.cancelVoucher(h.db, b.voucher.id);
    expect(await v.boughtVouchers(h.db, buyer.id)).toEqual([]);
  });

  it("prints a one-page A5 voucher", async () => {
    const bytes = await voucherPdf({
      title: "Permanentka 10 vstupů",
      recipientName: "Jana",
      message: "Ať tě pohyb baví a hlava si odpočine.",
      code: "7KQ4-M2PX",
      validUntil: NOW,
      redeemUrl: "https://example.cz/poukaz?kod=7KQ4M2PX",
      provider: { company: "OCTOPUSH s.r.o.", address: "Pospolitá 699/16, Ostrava", web: "https://example.cz", email: "a@b.cz", phone: "" },
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(Math.round(pdf.getPage(0).getWidth())).toBe(595);
  });
});
