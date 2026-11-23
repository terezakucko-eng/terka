import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classSessions, classTypes } from "@/db/schema";
import { bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { saveSettings } from "@/lib/settings";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 900, memberBookingWindowDays: 900 });
});
afterAll(async () => h.close());

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0170_reformer_free_intro.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};

describe("migration 0170: the first Reformer is free", () => {
  it("lets the welcome free entry onto Reformer fusion, drops the 200 Kč first lesson, keeps special sessions and Duo", async () => {
    const values = { noFreeEntry: true, firstVisitPrice: 20000, firstVisitNewOnly: true, passCardEntry: true, capacity: 6, creditCost: 340, dropInPrice: 39000 };
    const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const reformer = had
      ? (await h.db.update(classTypes).set(values).where(eq(classTypes.id, had.id)).returning())[0]
      : (await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion", ...values }).returning())[0];
    const [duo] = await h.db.insert(classTypes).values({ name: "Duo", slug: "reformer-duo-intro", noFreeEntry: true, capacity: 2 }).returning();
    const session = (typeId: string, local: string, over: Partial<typeof classSessions.$inferInsert> = {}) =>
      h.db.insert(classSessions).values({ classTypeId: typeId, startsAt: pragueLocalToDate(local), durationMin: 60, capacity: 6, creditCost: 340, dropInPrice: 39000, ...over }).returning().then((r) => r[0]);
    const regular = await session(reformer.id, "2027-02-03T17:00", { noFreeEntry: true });
    const special = await session(reformer.id, "2027-02-05T18:30", { noFreeEntry: true, title: "Reformer special", capacity: 12 });
    const duoSession = await session(duo.id, "2027-02-02T18:00", { capacity: 2 });

    await migrate();
    const [ct] = await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id));
    expect(ct).toMatchObject({ noFreeEntry: false, firstVisitPrice: null, firstVisitNewOnly: false, passCardEntry: true });
    const s = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0];
    expect((await s(regular.id)).noFreeEntry).toBe(false);
    expect((await s(special.id)).noFreeEntry).toBe(true);
    expect((await h.db.select().from(classTypes).where(eq(classTypes.id, duo.id)))[0].noFreeEntry).toBe(true);

    // a newcomer's welcome entry now books the Reformer – not the Duo
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Úvodní vstup zdarma", entries: 1, validityDays: 900 }, NOW);
    const free = async (x: typeof regular) => (await h.db.transaction((tx) => bookingOptions(tx, u.id, x))).find((o) => o.method === "free")!;
    expect((await free(await s(regular.id))).disabled).toBeUndefined();
    expect((await free(duoSession)).disabled).toMatch(/nejde/);

    // again: nothing changes; a rule the studio sets back stays
    await h.db.update(classTypes).set({ noFreeEntry: true, firstVisitPrice: 15000 }).where(eq(classTypes.id, reformer.id));
    await migrate();
    expect((await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id)))[0]).toMatchObject({ noFreeEntry: true, firstVisitPrice: 15000 });
  });
});
