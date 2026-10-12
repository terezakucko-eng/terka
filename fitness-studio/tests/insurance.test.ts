import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orders } from "@/db/schema";
import { findConfirmation, formatCode, hasConfirmation, insurancePayments, insuranceYears, issueConfirmation } from "@/domain/insurance";
import { recordPastFees } from "@/domain/membership-fees";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("insurance confirmation", () => {
  it("records past membership fees once and counts only paid sport payments", async () => {
    const u = await makeUser(h.db);
    expect(await recordPastFees(h.db, { userId: u.id, from: "2026-01", to: "2026-09", amountKc: 1000 }, NOW)).toEqual({ recorded: 9, skipped: 0 });
    expect(await recordPastFees(h.db, { userId: u.id, from: "2026-08", to: "2026-10", amountKc: 1000 }, NOW)).toEqual({ recorded: 1, skipped: 2 });
    await expect(recordPastFees(h.db, { userId: u.id, from: "2026-11", to: "2026-11", amountKc: 1000 }, NOW)).rejects.toThrow();
    await expect(recordPastFees(h.db, { userId: u.id, from: "2026-05", to: "2026-04", amountKc: 1000 }, NOW)).rejects.toThrow();

    const pass = await makeProduct(h.db, { kind: "pass", entries: 10 });
    const sun = await makeProduct(h.db, { kind: "solarium" });
    const paid = { userId: u.id, status: "paid" as const, provider: "reception" };
    await h.db.insert(orders).values([
      { ...paid, kind: "product", productId: pass.id, description: "Permanentka 10 vstupů", amount: 250000, paidAt: new Date("2026-10-02T10:00:00Z") },
      { ...paid, kind: "product", productId: sun.id, description: "Solárium", amount: 50000, paidAt: new Date("2026-10-02T10:00:00Z") },
      { ...paid, kind: "massage", description: "Masáž", amount: 90000, paidAt: new Date("2026-10-03T10:00:00Z") },
      { ...paid, kind: "surcharge", description: "Doplatek – brunch", amount: 15000, paidAt: new Date("2026-10-03T10:00:00Z") },
      { ...paid, kind: "drop_in", description: "Zumba", amount: 25000, paidAt: new Date("2025-12-31T23:30:00Z") }, // 1. 1. 2026 in Prague
      { ...paid, kind: "drop_in", description: "Pilates", amount: 25000, paidAt: new Date("2025-06-01T10:00:00Z") },
      { userId: u.id, status: "refunded", provider: "stripe", kind: "drop_in", description: "Vráceno", amount: 25000, paidAt: new Date("2026-03-01T10:00:00Z") },
      { userId: u.id, status: "pending", provider: "transfer", kind: "membership_fee", period: "2026-11", description: "Listopad", amount: 100000 },
    ]);

    expect(await insuranceYears(h.db, u.id)).toEqual([2026, 2025]);
    const y = await insurancePayments(h.db, u.id, 2026);
    expect(y.items.map((i) => i.description)).toEqual([
      "Zumba",
      "Členský příspěvek – leden 2026",
      "Členský příspěvek – únor 2026",
      "Členský příspěvek – březen 2026",
      "Členský příspěvek – duben 2026",
      "Členský příspěvek – květen 2026",
      "Členský příspěvek – červen 2026",
      "Členský příspěvek – červenec 2026",
      "Členský příspěvek – srpen 2026",
      "Členský příspěvek – září 2026",
      "Členský příspěvek – říjen 2026",
      "Permanentka 10 vstupů",
    ]);
    expect(y.total).toBe(25000 + 10 * 100000 + 250000);
    expect((await insurancePayments(h.db, u.id, 2025)).total).toBe(25000);
  });
});

describe("confirmation codes", () => {
  it("reuses the code while nothing changes and verifies typed codes", async () => {
    const u = await makeUser(h.db);
    expect(await issueConfirmation(h.db, { ...u, birthDate: null }, 2026)).toBeNull();
    await recordPastFees(h.db, { userId: u.id, from: "2026-01", to: "2026-02", amountKc: 1000 }, NOW);
    const a = (await issueConfirmation(h.db, { ...u, birthDate: null }, 2026))!;
    expect(a.total).toBe(200000);
    expect(a.confirmation.code).toMatch(/^[A-Z2-9]{8}$/);
    expect((await issueConfirmation(h.db, { ...u, birthDate: null }, 2026))!.confirmation.code).toBe(a.confirmation.code);
    const b = (await issueConfirmation(h.db, { ...u, birthDate: "1990-03-12" }, 2026))!;
    expect(b.confirmation.code).not.toBe(a.confirmation.code);
    expect(b.confirmation.birthDate).toBe("1990-03-12");

    const typed = ` ${formatCode(b.confirmation.code).toLowerCase()} `;
    expect((await findConfirmation(h.db, typed))?.id).toBe(b.confirmation.id);
    expect(await findConfirmation(h.db, "AAAA-AAAA")).toBeNull();
    expect(await findConfirmation(h.db, "x")).toBeNull();
  });
});

describe("anti-fraud", () => {
  it("locks the profile after a confirmation and flags later refunds", async () => {
    const u = await makeUser(h.db);
    await recordPastFees(h.db, { userId: u.id, from: "2026-03", to: "2026-04", amountKc: 1000 }, NOW);
    expect(await hasConfirmation(h.db, u.id)).toBe(false);
    const issued = (await issueConfirmation(h.db, { ...u, birthDate: "1985-01-02" }, 2026))!;
    expect(await hasConfirmation(h.db, u.id)).toBe(true);
    expect((await findConfirmation(h.db, issued.confirmation.code))?.paidNow).toBe(200000);
    await h.db.update(orders).set({ status: "refunded" }).where(eq(orders.id, issued.items[0].id));
    const after = (await findConfirmation(h.db, issued.confirmation.code))!;
    expect(after.total).toBe(200000);
    expect(after.paidNow).toBe(100000);
  });
});
