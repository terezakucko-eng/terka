import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, entitlements, orders, products, users, type Product } from "@/db/schema";
import { createMonthlyFees, switchMembership } from "@/domain/membership-fees";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeProduct, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
let tier: Product;
let flexible: Product;
const JAN = pragueLocalToDate("2027-01-01T00:00");
const DAY = 86_400_000;

beforeAll(async () => {
  h = await testDb();
  const [ct] = await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion" }).returning();
  // Členství Reformer in presale – the same id as in the studio
  tier = await makeProduct(h.db, {
    id: "b09203a4-b468-4653-be2b-01d41922d888",
    kind: "membership",
    name: "Členství Reformer",
    price: 250000,
    validityDays: 365,
    includedClassTypeId: ct.id,
    includedPerMonth: 8,
    maxActive: 10,
    saleFrom: JAN,
    presaleFrom: NOW,
  });
  flexible = await makeProduct(h.db, { kind: "membership", name: "Členství bez závazku", price: 160000, validityDays: 3650, commitmentMonths: 0 });
});
afterAll(async () => h.close());

let n = 0;
const client = async (name: string) =>
  (await h.db.insert(users).values({ email: `rk${++n}@test.cz`, name, passwordHash: "x" }).returning())[0];
const membership = (userId: string, validUntil: Date) =>
  grantEntitlement(h.db, { userId, kind: "membership", name: "Členství 2026", entries: null, validityDays: 1, validUntil }, NOW);
const mine = (userId: string) => h.db.select().from(entitlements).where(eq(entitlements.userId, userId));

describe("switching to Členství Reformer in presale (from January)", () => {
  it("keeps the old fee for November and December, the new one from January", async () => {
    const plain = await client("Fee Plain");
    const e1 = await membership(plain.id, pragueLocalToDate("2027-09-01T00:00"));
    const special = await client("Fee Special");
    const e2 = await membership(special.id, pragueLocalToDate("2027-09-01T00:00"));
    await h.db.update(entitlements).set({ monthlyFee: 100000, monthlyFeeUntil: "2026-12" }).where(eq(entitlements.id, e2.id));

    expect((await switchMembership(h.db, plain.id, e1.id, tier.id, NOW)).period).toBe("2027-01");
    expect((await switchMembership(h.db, special.id, e2.id, tier.id, NOW)).period).toBe("2027-01");
    const fee = async (period: string, userId: string) =>
      (await createMonthlyFees(h.db, { period, amountKc: 1400, userIds: [userId] }))[0].amount;
    expect([await fee("2026-11", plain.id), await fee("2026-12", plain.id), await fee("2027-01", plain.id)]).toEqual([140000, 140000, 250000]);
    expect([await fee("2026-11", special.id), await fee("2027-01", special.id)]).toEqual([100000, 250000]);
  });
});

describe("migration 0085: Členství Reformer set up for one client", () => {
  // the client is found by a hash of her surname – the tests put in their own
  const md5 = (s: string) => createHash("md5").update(s).digest("hex");
  const run = async (surname: string) => {
    const text = readFileSync("drizzle/0085_reformer_for_client.sql", "utf8")
      .replaceAll("750d082c1299ae67208f0d1e0a36c373", md5(surname))
      .replaceAll("cc8035ef80c65185d318f9583f1bf892", md5(surname));
    for (const statement of text.split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
  };

  it("a membership with commitment running into January switches from January", async () => {
    const u = await client("Alena Prvníková");
    const e = await membership(u.id, pragueLocalToDate("2027-06-30T00:00"));
    await run("prvníková");
    await run("prvníková");
    const rows = await mine(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: e.id, productId: tier.id, name: "Členství Reformer", monthlyFee: 250000, monthlyFeeBefore: null, includedPerMonth: 8, includedFrom: "2027-01" });
    expect(rows[0].validUntil).toEqual(e.validUntil); // commitment unchanged
  });

  it("a membership ending in December: a new one from 1 January", async () => {
    const u = await client("Druhá Bára");
    const old = await membership(u.id, JAN);
    await run("druhá");
    await run("druhá");
    const rows = await mine(u.id);
    expect(rows).toHaveLength(2);
    const added = rows.find((r) => r.id !== old.id)!;
    expect(added).toMatchObject({ productId: tier.id, validFrom: JAN, monthlyFee: 250000, includedPerMonth: 8, includedFrom: null, orderId: null });
    expect(added.validUntil).toEqual(new Date(JAN.getTime() + 365 * DAY));
    expect(rows.find((r) => r.id === old.id)).toMatchObject({ productId: null, includedPerMonth: 0 });
  });

  it("a membership without commitment ends with December, the new one starts in January", async () => {
    const u = await client("Cecílie Třetí");
    const flex = await membership(u.id, new Date(NOW.getTime() + 3650 * DAY));
    await h.db.update(entitlements).set({ productId: flexible.id, monthlyFee: 160000 }).where(eq(entitlements.id, flex.id));
    await run("třetí");
    const rows = await mine(u.id);
    expect(rows.find((r) => r.id === flex.id)).toMatchObject({ validUntil: JAN, renewalCancelled: true });
    expect(rows.find((r) => r.id !== flex.id)).toMatchObject({ productId: tier.id, validFrom: JAN });
  });

  it("does nothing while she pays her own order, or when the surname matches two clients", async () => {
    const paying = await client("Dana Čtvrtá");
    await h.db.insert(orders).values({ userId: paying.id, kind: "product", productId: tier.id, description: tier.name, amount: tier.price, provider: "transfer", expiresAt: new Date("2030-01-01") });
    await run("čtvrtá");
    expect(await mine(paying.id)).toHaveLength(0);

    const a = await client("Eva Pátá");
    const b = await client("Ema Pátá");
    await run("pátá");
    expect(await h.db.select().from(entitlements).where(and(eq(entitlements.productId, tier.id), sql`${entitlements.userId} in (${a.id}, ${b.id})`))).toHaveLength(0);
    expect((await h.db.select().from(products).where(eq(products.id, tier.id)))[0].isActive).toBe(true);
  });
});
