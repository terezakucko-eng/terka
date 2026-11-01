import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders, users } from "@/db/schema";
import { feeOverview } from "@/domain/membership-fees";
import { grantEntitlement } from "@/domain/users";
import { NOW, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const statements = (file: string, from = 0) =>
  readFileSync(file, "utf8")
    .replaceAll("f5e1943993c370caf822494afc842f88", md5("platilkova"))
    .replaceAll("e018630b6d7d9c1fdebb6b9815b21807", md5("druhovska"))
    .split("--> statement-breakpoint")
    .slice(from);
const run = async (file: string, from = 0) => {
  for (const s of statements(file, from)) await h.db.execute(sql.raw(s));
};
const novFees = (userId: string) =>
  h.db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.period, "2026-11")));

describe("migration 0116: November top-up for the member who pays for both", () => {
  it("paid 1 400 Kč for November before the deal: a top-up request for the remaining 600 Kč", async () => {
    const [payer] = await h.db.insert(users).values({ email: "top1@test.cz", name: "Petra Platílková", passwordHash: "x" }).returning();
    await h.db.insert(users).values({ email: "top2@test.cz", name: "Olga Druhovská", passwordHash: "x" });
    // still running when 0115 runs – it only takes memberships valid at that moment (real clock)
    await grantEntitlement(h.db, { userId: payer.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 1, validUntil: new Date(Date.now() + 30 * 86_400_000) }, NOW);
    await h.db.insert(orders).values({ userId: payer.id, kind: "membership_fee", period: "2026-11", description: "listopad", amount: 140000, provider: "transfer", status: "paid", paidAt: NOW });

    await run("drizzle/0115_monthly_fee_after.sql", 1); // the column is there already
    expect((await novFees(payer.id)).map((o) => [o.amount, o.status])).toEqual([[140000, "paid"]]);

    await run("drizzle/0116_november_top_up.sql");
    await run("drizzle/0116_november_top_up.sql"); // safe to run again
    const fees = await novFees(payer.id);
    expect(fees.map((o) => [o.amount, o.status]).sort()).toEqual([[140000, "paid"], [60000, "pending"]]);
    const topUp = fees.find((o) => o.status === "pending")!;
    expect(topUp.description).toContain("Doplatek");

    // Příspěvky: the month isn't settled until the top-up is paid
    const row = async () => (await feeOverview(h.db, "2026-11")).rows.find((r) => r.userId === payer.id);
    expect(await row()).toMatchObject({ status: "pending", amount: 60000, order: { id: topUp.id } });
    await h.db.update(orders).set({ status: "paid", paidAt: NOW }).where(eq(orders.id, topUp.id));
    expect(await row()).toMatchObject({ status: "paid", amount: 200000 });

    // paid in full: nothing more
    await run("drizzle/0116_november_top_up.sql");
    expect(await novFees(payer.id)).toHaveLength(2);
    expect((await h.db.select().from(entitlements).where(eq(entitlements.userId, payer.id)))[0].monthlyFee).toBe(200000);
  });
});
