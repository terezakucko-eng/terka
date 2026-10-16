import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements } from "@/db/schema";
import { pragueLocalToDate } from "@/lib/dates";
import { makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const at = (local: string) => pragueLocalToDate(local);
const YEAR_END = at("2026-12-31T23:59");

describe("migration 0089: Členství 2026 until 31 December 2026", () => {
  it("sets every one to the end of 2026 – except the 50 % one, cancelled ones and card subscriptions", async () => {
    const u = await makeUser(h.db);
    const discounted = await makeProduct(h.db, { kind: "membership", name: "Členství 2026 – sleva 50 %", price: 70000 });
    const row = (over: Partial<typeof entitlements.$inferInsert>) =>
      h.db.insert(entitlements).values({ userId: u.id, kind: "membership", name: "Členství 2026", validFrom: at("2026-10-02T10:00"), validUntil: at("2026-11-02T10:00"), ...over }).returning().then((r) => r[0]);
    const short = await row({});
    const expired = await row({ validFrom: at("2026-09-01T10:00"), validUntil: at("2026-10-01T10:00") });
    const long = await row({ validUntil: at("2027-10-01T23:59") });
    const imported = await row({ note: "převod ze starého systému", validFrom: at("2026-09-28T00:00") });
    const half = await row({ monthlyFee: 70000 });
    const halfNote = await row({ note: "sleva 50 % – rodina" });
    const halfProduct = await row({ productId: discounted.id, name: discounted.name });
    const cancelled = await row({ status: "cancelled" });
    const card = await row({ subscriptionId: "sub_x" });
    const other = await row({ name: "Členství bez závazku" });

    const update = readFileSync("drizzle/0089_membership_2026_to_year_end.sql", "utf8");
    await h.db.execute(sql.raw(update));
    await h.db.execute(sql.raw(update)); // safe to repeat
    const until = async (e: { id: string }) => (await h.db.select().from(entitlements).where(eq(entitlements.id, e.id)))[0].validUntil;
    for (const e of [short, expired, long, imported]) expect(await until(e)).toEqual(YEAR_END);
    for (const e of [half, halfNote, halfProduct, cancelled, card, other]) expect(await until(e)).toEqual(e.validUntil);
  });
});
