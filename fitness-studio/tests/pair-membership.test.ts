import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders, users, type Product } from "@/db/schema";
import { createMonthlyFees, feeOverview, followMonthlyFee, ownFee } from "@/domain/membership-fees";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
let classic: Product;
beforeAll(async () => {
  h = await testDb();
  classic = await makeProduct(h.db, { kind: "membership", name: "Členství 2026", price: 120000, validityDays: 365 });
});
afterAll(async () => h.close());

const NOV = pragueLocalToDate("2026-11-01T00:00");
const NOV27 = pragueLocalToDate("2027-11-01T00:00");
const year = { entries: null, validityDays: 365 } as const;
const fees = (userId: string) =>
  h.db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee")));

describe("a special fee for a few months, then another one", () => {
  it("2 000 Kč through December, then 1 000 Kč; 0 Kč means no fee and shows as „bez příspěvku“", async () => {
    const payer = await makeUser(h.db);
    const other = await makeUser(h.db);
    const e1 = await grantEntitlement(h.db, { userId: payer.id, kind: "membership", name: "Členství", ...year }, NOW);
    const e2 = await grantEntitlement(h.db, { userId: other.id, kind: "membership", name: "Členství", ...year }, NOW);
    await h.db.update(entitlements).set({ monthlyFee: 200000, monthlyFeeUntil: "2026-12", monthlyFeeAfter: 100000 }).where(eq(entitlements.id, e1.id));
    await h.db.update(entitlements).set({ monthlyFee: 0, monthlyFeeUntil: "2026-12", monthlyFeeAfter: 100000 }).where(eq(entitlements.id, e2.id));

    const ids = [payer.id, other.id];
    const amounts = async (period: string) =>
      (await createMonthlyFees(h.db, { period, amountKc: 1400, userIds: ids })).map((o) => [o.userId === payer.id ? "payer" : "other", o.amount]);
    expect(await amounts("2026-11")).toEqual([["payer", 200000]]);
    expect(await amounts("2026-12")).toEqual([["payer", 200000]]);
    expect((await amounts("2027-01")).sort()).toEqual([["other", 100000], ["payer", 100000]]);

    const nov = await feeOverview(h.db, "2026-11");
    expect(nov.rows.find((r) => r.userId === other.id)).toMatchObject({ status: "free", amount: 0 });
    expect(nov.rows.find((r) => r.userId === payer.id)).toMatchObject({ status: "pending", amount: 200000 });
  });

  it("no fee after the special months = the default one", () => {
    const terms = { monthlyFee: 100000, monthlyFeeUntil: "2026-12", monthlyFeeAfter: null, monthlyFeeBefore: null, includedFrom: null };
    expect(ownFee(terms, "2026-12")).toBe(100000);
    expect(ownFee(terms, "2027-01")).toBeNull();
  });

  it("a changed fee after the special months: unpaid requests from then on follow it", async () => {
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", ...year }, NOW);
    for (const period of ["2026-12", "2027-01", "2027-02"])
      await h.db.insert(orders).values({ userId: u.id, kind: "membership_fee", period, description: period, amount: 140000, provider: "transfer" });
    expect(await followMonthlyFee(h.db, u.id, 140000, 100000, NOW, null, "2026-12")).toEqual(["2027-01", "2027-02"]);
    expect((await fees(u.id)).find((o) => o.period === "2026-12")!.amount).toBe(140000);
  });
});

describe("migration 0115: two clients share a membership deal", () => {
  // the clients are found by a hash of their surname without diacritics – the tests put in their own
  const md5 = (s: string) => createHash("md5").update(s).digest("hex");
  const run = async (payer: string, other: string) => {
    const text = readFileSync("drizzle/0115_monthly_fee_after.sql", "utf8")
      .split("--> statement-breakpoint")
      .slice(1) // the column is there already
      .join("--> statement-breakpoint")
      .replaceAll("f5e1943993c370caf822494afc842f88", md5(payer))
      .replaceAll("e018630b6d7d9c1fdebb6b9815b21807", md5(other));
    for (const statement of text.split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
  };
  let n = 0;
  const client = async (name: string) =>
    (await h.db.insert(users).values({ email: `pair${++n}@test.cz`, name, passwordHash: "x" }).returning())[0];
  const mine = (userId: string) => h.db.select().from(entitlements).where(eq(entitlements.userId, userId));

  it("the payer's membership is set from November for 12 months, the other one gets a new one", async () => {
    const payer = await client("Petra Platílková");
    const other = await client("Olga Druhovská");
    // still running when the migration runs – it only takes memberships valid at that moment (real clock)
    const running = new Date(Date.now() + 30 * 86_400_000);
    const e = await grantEntitlement(h.db, { userId: payer.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 1, validUntil: running }, NOW);
    await h.db.update(entitlements).set({ productId: classic.id, monthlyFee: 100000 }).where(eq(entitlements.id, e.id));
    // her November request at the old fee is already out
    await h.db.insert(orders).values({ userId: payer.id, kind: "membership_fee", period: "2026-11", description: "listopad", amount: 100000, provider: "transfer" });

    await run("platilkova", "druhovska");
    await run("platilkova", "druhovska"); // safe to run again

    const [p] = await mine(payer.id);
    expect(p).toMatchObject({ id: e.id, monthlyFee: 200000, monthlyFeeUntil: "2026-12", monthlyFeeAfter: 100000, validFrom: e.validFrom, validUntil: NOV27 });
    const o = await mine(other.id);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ kind: "membership", productId: classic.id, validFrom: NOV, validUntil: NOV27, monthlyFee: 0, monthlyFeeUntil: "2026-12", monthlyFeeAfter: 100000 });
    expect((await fees(payer.id)).map((f) => [f.period, f.amount, f.status])).toEqual([["2026-11", 200000, "pending"]]);

    // the monthly runs: December for the payer only, from January both 1 000 Kč
    const ids = [payer.id, other.id];
    expect((await createMonthlyFees(h.db, { period: "2026-12", amountKc: 1400, userIds: ids })).map((f) => [f.userId, f.amount])).toEqual([[payer.id, 200000]]);
    expect((await createMonthlyFees(h.db, { period: "2027-01", amountKc: 1400, userIds: ids })).map((f) => f.amount)).toEqual([100000, 100000]);
  });

  it("no membership yet for the payer: she gets one too, with the November request", async () => {
    const payer = await client("Petra Novákovská");
    const other = await client("Olga Nováčková");
    await run("novakovska", "novackova");
    expect(await mine(payer.id)).toMatchObject([{ validFrom: NOV, validUntil: NOV27, monthlyFee: 200000 }]);
    expect((await fees(payer.id)).map((f) => [f.period, f.amount])).toEqual([["2026-11", 200000]]);
    expect((await fees(other.id))).toHaveLength(0);
  });

  it("nothing changes when one of them can't be told apart or isn't there", async () => {
    const payer = await client("Petra Dvojitá");
    await client("Jana Dvojitá");
    const other = await client("Olga Samotná");
    await run("dvojita", "samotna");
    expect(await mine(payer.id)).toHaveLength(0);
    expect(await mine(other.id)).toHaveLength(0);

    const alone = await client("Petra Osamělá");
    await run("osamela", "nikdo");
    expect(await mine(alone.id)).toHaveLength(0);
  });
});
