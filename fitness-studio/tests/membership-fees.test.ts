import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders } from "@/db/schema";
import { createMonthlyFees, feeOverview, membersInMonth, periodLabel, shiftPeriod } from "@/domain/membership-fees";
import { abandonOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("membership fees", () => {
  it("creates one fee per member and month, with own fee and discount, and tracks payment", async () => {
    const a = await makeUser(h.db);
    const b = await makeUser(h.db);
    const c = await makeUser(h.db);
    const stripe = await makeUser(h.db);
    const gone = await makeUser(h.db);
    const year = { entries: null, validityDays: 365 } as const;
    await grantEntitlement(h.db, { userId: a.id, kind: "membership", name: "Členství", ...year }, NOW);
    const eb = await grantEntitlement(h.db, { userId: b.id, kind: "membership", name: "Členství", ...year }, NOW);
    await h.db.update(entitlements).set({ monthlyFee: 100000 }).where(eq(entitlements.id, eb.id));
    await grantEntitlement(h.db, { userId: c.id, kind: "pass", name: "Permanentka", entries: 10, validityDays: 60 }, NOW);
    const es = await grantEntitlement(h.db, { userId: stripe.id, kind: "membership", name: "Členství", ...year }, NOW);
    await h.db.update(entitlements).set({ subscriptionId: "sub_1" }).where(eq(entitlements.id, es.id));
    await grantEntitlement(h.db, { userId: gone.id, kind: "membership", name: "Členství", entries: null, validityDays: 3 }, NOW);

    const period = shiftPeriod("2026-10", 0); // NOW is 5. 10. 2026
    expect(periodLabel(period)).toBe("říjen 2026");
    expect((await membersInMonth(h.db, "2026-11")).map((m) => m.userId).sort()).toEqual([a.id, b.id, stripe.id].sort());

    const created = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, discountPct: 50 });
    expect(created.map((o) => [o.userId, o.amount]).sort()).toEqual([[a.id, 70000], [b.id, 50000]].sort());
    expect(await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400 })).toHaveLength(0);

    const feeA = created.find((o) => o.userId === a.id)!;
    await abandonOrder(h.db, feeA.id); // closed card checkout – still due
    expect((await h.db.select().from(orders).where(eq(orders.id, feeA.id)))[0].status).toBe("pending");
    await fulfillOrder(h.db, { orderId: feeA.id, provider: "transfer" });

    const { rows, totals } = await feeOverview(h.db, "2026-11");
    const st = Object.fromEntries(rows.map((r) => [r.userId, r.status]));
    expect(st).toEqual({ [a.id]: "paid", [b.id]: "pending", [stripe.id]: "auto" });
    expect(totals).toMatchObject({ members: 3, paid: 1, pending: 1, none: 0, collected: 70000 });
  });
});
