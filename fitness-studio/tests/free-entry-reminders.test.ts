import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, users } from "@/db/schema";
import { freeEntriesExpiring, markFreeEntryReminded } from "@/domain/free-entries";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const DAY = 86_400_000;
const at = (days: number) => new Date(+NOW + days * DAY);

/** A free entry given `givenDaysAgo` days ago, running out in `leftDays` days. */
async function free(over: { givenDaysAgo?: number; leftDays: number; entries?: number; used?: number }) {
  const u = await makeUser(h.db);
  const e = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Úvodní lekce zdarma", entries: over.entries ?? 1, validityDays: 30 }, NOW);
  await h.db
    .update(entitlements)
    .set({ createdAt: at(-(over.givenDaysAgo ?? 25)), validUntil: at(over.leftDays), entriesUsed: over.used ?? 0 })
    .where(eq(entitlements.id, e.id));
  return { u, e };
}
const ids = async (stage: "week" | "lastCall", now = NOW) => (await freeEntriesExpiring(h.db, stage, now)).map((r) => r.id);

describe("unused free entries running out", () => {
  it("a week ahead, then the day before – each once", async () => {
    const { e } = await free({ leftDays: 6 });
    expect(await ids("week")).toContain(e.id);
    expect(await ids("lastCall")).not.toContain(e.id);
    await markFreeEntryReminded(h.db, e.id, "week", NOW);
    expect(await ids("week")).not.toContain(e.id);

    const dayBefore = at(5.2);
    expect(await ids("lastCall", dayBefore)).toContain(e.id);
    await markFreeEntryReminded(h.db, e.id, "lastCall", dayBefore);
    expect(await ids("lastCall", dayBefore)).not.toContain(e.id);
    // gone – nothing more
    expect(await ids("lastCall", at(7))).not.toContain(e.id);
  });

  it("says how many are left; not when used up, run out, or the client's account is deleted", async () => {
    const two = await free({ leftDays: 5, entries: 2, used: 1 });
    expect((await freeEntriesExpiring(h.db, "week", NOW)).find((r) => r.id === two.e.id)).toMatchObject({ left: 1, name: "Úvodní lekce zdarma" });
    const used = await free({ leftDays: 5, entries: 1, used: 1 });
    const gone = await free({ leftDays: -1 });
    const deleted = await free({ leftDays: 5 });
    await h.db.update(users).set({ deletedAt: NOW }).where(eq(users.id, deleted.u.id));
    for (const stage of ["week", "lastCall"] as const) {
      const list = await ids(stage);
      for (const x of [used, gone, deleted]) expect(list).not.toContain(x.e.id);
    }
  });

  it("an entry given for a few days gets only the last-day reminder; that one closes the week one too", async () => {
    const { e } = await free({ givenDaysAgo: 0, leftDays: 5 });
    expect(await ids("week")).not.toContain(e.id);
    const { e: soon } = await free({ leftDays: 1 });
    expect(await ids("week")).not.toContain(soon.id);
    expect(await ids("lastCall")).toContain(soon.id);
    await markFreeEntryReminded(h.db, soon.id, "lastCall", NOW);
    const [row] = await h.db.select().from(entitlements).where(eq(entitlements.id, soon.id));
    expect(row.lastCallAt).toEqual(NOW);
    expect(row.expiryWarnedAt).toEqual(NOW);
  });
});
